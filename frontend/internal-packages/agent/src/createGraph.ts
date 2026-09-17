import { AIMessage, isHumanMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import { END, START, StateGraph } from '@langchain/langgraph'
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint'
import { isEmptySchema } from '@liam-hq/schema'
import { QA_AGENT_RECURSION_LIMIT } from './constants'
import { createDbAgentGraph } from './db-agent/createDbAgentGraph'
import { convertRequirementsToPrompt } from './db-agent/utils/convertAnalyzedRequirementsToPrompt'
import { createLeadAgentGraph } from './lead-agent/createLeadAgentGraph'
import { createPmAgentGraph } from './pm-agent/createPmAgentGraph'
import { createQaAgentGraph } from './qa-agent/createQaAgentGraph'
import { SAVE_TESTCASE_TOOL_NAME } from './qa-agent/tools/saveTestcaseTool'
import type { WorkflowState } from './types'
import { excludeToolCallRoundtrips } from './utils/messageCleanup'
import { validateInitialSchemaNode } from './workflow/nodes/validateInitialSchemaNode'
import { workflowAnnotation } from './workflowAnnotation'

/**
 * Create and configure the LangGraph workflow
 *
 * @param checkpointer - Optional checkpoint saver for persistent state management
 */
export const createGraph = (checkpointer?: BaseCheckpointSaver) => {
  const leadAgentSubgraph = createLeadAgentGraph()
  const pmAgentSubgraph = createPmAgentGraph()
  const dbAgentSubgraph = createDbAgentGraph()
  const qaAgentSubgraph = createQaAgentGraph()

  const callDbAgent = async (state: WorkflowState, config: RunnableConfig) => {
    // Extract user input from the first HumanMessage
    const userInput =
      state.messages.find((msg) => isHumanMessage(msg))?.text || ''

    const prompt = convertRequirementsToPrompt(
      state.analyzedRequirements,
      userInput,
      state.schemaIssues,
    )
    const modifiedState = { ...state, messages: [], prompt }
    const output = await dbAgentSubgraph.invoke(modifiedState, config)

    // Clear schemaIssues after DB agent processing to prevent infinite loops
    return { ...state, ...output, schemaIssues: [] }
  }

  const callQaAgent = async (state: WorkflowState, config: RunnableConfig) => {
    const modifiedState = { ...state, messages: [] }
    const output = await qaAgentSubgraph.invoke(modifiedState, {
      ...config,
      recursionLimit: QA_AGENT_RECURSION_LIMIT,
    })

    // Keep the per-test-case saveTestcase round-trips out of the shared
    // thread history - the final run-test result already summarizes what
    // matters, and the raw per-call noise would otherwise make every future
    // turn's request to the model grow without bound (see
    // excludeToolCallRoundtrips docs).
    const messages = output.messages
      ? excludeToolCallRoundtrips(output.messages, [SAVE_TESTCASE_TOOL_NAME])
      : output.messages

    return { ...state, ...output, messages }
  }

  const callPmAgent = async (state: WorkflowState, config: RunnableConfig) => {
    const output = await pmAgentSubgraph.invoke(
      {
        messages: state.messages,
        analyzedRequirements: state.analyzedRequirements,
        designSessionId: state.designSessionId,
        schemaData: state.schemaData,
        analyzedRequirementsRetryCount: 0,
      },
      config,
    )

    return { ...state, ...output }
  }

  const graph = new StateGraph(workflowAnnotation)
    .addNode('validateInitialSchema', validateInitialSchemaNode)
    .addNode('leadAgent', leadAgentSubgraph)
    .addNode('pmAgent', callPmAgent, { subgraphs: [pmAgentSubgraph] })
    .addNode('dbAgent', callDbAgent, { subgraphs: [dbAgentSubgraph] })
    .addNode('qaAgent', callQaAgent, { subgraphs: [qaAgentSubgraph] })

    .addConditionalEdges(
      START,
      (state) => {
        const isFirstExecution = !state.messages.some(
          (msg) => msg instanceof AIMessage,
        )

        const shouldValidateSchema =
          isFirstExecution && !isEmptySchema(state.schemaData)
        if (shouldValidateSchema) {
          return 'validateInitialSchema'
        }

        return 'leadAgent'
      },
      {
        validateInitialSchema: 'validateInitialSchema',
        leadAgent: 'leadAgent',
      },
    )
    .addEdge('validateInitialSchema', 'leadAgent')

    .addConditionalEdges('leadAgent', (state) => state.next, {
      pmAgent: 'pmAgent',
      dbAgent: 'dbAgent',
      [END]: END,
    })
    .addEdge('pmAgent', 'dbAgent')
    .addEdge('dbAgent', 'qaAgent')
    .addEdge('qaAgent', 'leadAgent')

  return checkpointer ? graph.compile({ checkpointer }) : graph.compile()
}
