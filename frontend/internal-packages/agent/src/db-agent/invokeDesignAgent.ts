import {
  type AIMessage,
  type AIMessageChunk,
  type BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { fromAsyncThrowable } from '@liam-hq/neverthrow'
import { okAsync, ResultAsync } from 'neverthrow'
import * as v from 'valibot'
import { SSE_EVENTS } from '../streaming/constants'
import type { Reasoning } from '../types'
import { LLM_CLIENT_CONFIG, LLM_MODEL } from '../utils/llmConfig'
import { repairDanglingToolCalls } from '../utils/messageCleanup'
import { streamLLMResponse } from '../utils/streamingLlmUtils'
import { reasoningSchema } from '../utils/validationSchema'
import type { ToolConfigurable } from './getToolConfigurable'
import {
  type ContextPromptVariables,
  contextPromptTemplate,
  SYSTEM_PROMPT,
} from './prompt'
import { createMigrationTool } from './tools/createMigrationTool'

const AGENT_NAME = 'db' as const

const model = new ChatOpenAI({
  model: LLM_MODEL,
  streaming: true,
  ...LLM_CLIENT_CONFIG,
}).bindTools([createMigrationTool], {
  tool_choice: 'auto',
})

type DesignAgentResult = {
  response: AIMessage
  reasoning: Reasoning | null
}

export const invokeDesignAgent = (
  variables: ContextPromptVariables,
  messages: BaseMessage[],
  configurable: ToolConfigurable,
): ResultAsync<DesignAgentResult, Error> => {
  const formatContextPrompt = ResultAsync.fromSafePromise(
    contextPromptTemplate.format(variables),
  )
  const cleanedMessages = repairDanglingToolCalls(messages)

  const stream = fromAsyncThrowable((contextPrompt: string) =>
    model.stream(
      [
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(contextPrompt),
        ...cleanedMessages,
      ],
      { configurable },
    ),
  )

  const response = fromAsyncThrowable((stream: AsyncIterable<AIMessageChunk>) =>
    streamLLMResponse(stream, {
      agentName: AGENT_NAME,
      eventType: SSE_EVENTS.MESSAGES,
    }),
  )

  return formatContextPrompt
    .andThen(stream)
    .andThen(response)
    .andThen((response) => {
      const parsed = v.safeParse(
        reasoningSchema,
        response.additional_kwargs['reasoning'],
      )
      const reasoning = parsed.success ? parsed.output : null

      return okAsync({
        response,
        reasoning,
      })
    })
}
