import {
  AIMessage,
  type BaseMessage,
  isAIMessage,
  isToolMessage,
  ToolMessage,
} from '@langchain/core/messages'

/**
 * Remove reasoning field from a single AIMessage to avoid API issues
 * This prevents the "reasoning without required following item" error
 * when passing messages to subsequent OpenAI API calls
 */
export function removeReasoningFromMessage(message: BaseMessage): BaseMessage {
  if (message instanceof AIMessage) {
    const {
      content,
      additional_kwargs,
      response_metadata,
      tool_calls,
      invalid_tool_calls,
      usage_metadata,
    } = message
    const cleanedKwargs = { ...additional_kwargs }

    if ('reasoning' in cleanedKwargs) {
      delete cleanedKwargs['reasoning']
    }

    const aiMessageFields: {
      content: typeof content
      additional_kwargs: typeof cleanedKwargs
      response_metadata: typeof response_metadata
      tool_calls?: typeof tool_calls
      invalid_tool_calls?: typeof invalid_tool_calls
      usage_metadata?: typeof usage_metadata
    } = {
      content,
      additional_kwargs: cleanedKwargs,
      response_metadata,
    }

    if (tool_calls !== undefined) {
      aiMessageFields.tool_calls = tool_calls
    }
    if (invalid_tool_calls !== undefined) {
      aiMessageFields.invalid_tool_calls = invalid_tool_calls
    }
    if (usage_metadata !== undefined) {
      aiMessageFields.usage_metadata = usage_metadata
    }

    return new AIMessage(aiMessageFields)
  }
  return message
}

/**
 * Remove reasoning field from multiple messages
 */
export function removeReasoningFromMessages(
  messages: BaseMessage[],
): BaseMessage[] {
  return messages.map(removeReasoningFromMessage)
}

/**
 * Insert placeholder ToolMessages for any tool_calls left unanswered by a
 * prior turn (e.g. the request was aborted/timed out between the model
 * emitting tool_calls and the tool node recording their results, and that
 * half-finished state was checkpointed). OpenAI-compatible APIs reject an
 * assistant message with tool_calls that isn't immediately followed by a
 * ToolMessage for every one of those call ids ("insufficient tool messages
 * following tool_calls message" / INVALID_TOOL_RESULTS), so without this the
 * whole thread becomes permanently unusable once interrupted mid-tool-call.
 */
export function repairDanglingToolCalls(
  messages: BaseMessage[],
): BaseMessage[] {
  const result: BaseMessage[] = []
  let pendingIds: Set<string> | null = null

  const flushPending = () => {
    if (!pendingIds) return
    for (const id of pendingIds) {
      result.push(
        new ToolMessage({
          content:
            'Cancelled: the previous request was interrupted before this tool call completed.',
          tool_call_id: id,
        }),
      )
    }
    pendingIds = null
  }

  for (const message of messages) {
    if (pendingIds && pendingIds.size > 0) {
      if (isToolMessage(message) && pendingIds.has(message.tool_call_id)) {
        pendingIds.delete(message.tool_call_id)
        result.push(message)
        continue
      }
      flushPending()
    }

    result.push(message)

    pendingIds =
      isAIMessage(message) && message.tool_calls
        ? new Set(
            message.tool_calls
              .map((toolCall) => toolCall.id)
              .filter((id): id is string => id !== undefined),
          )
        : null
  }

  flushPending()

  return result
}

function excludedToolCallIds(
  message: BaseMessage,
  toolNames: readonly string[],
): Set<string> | null {
  if (!isAIMessage(message) || !message.tool_calls?.length) return null

  const allExcluded = message.tool_calls.every((toolCall) =>
    toolNames.includes(toolCall.name),
  )
  if (!allExcluded) return null

  return new Set(
    message.tool_calls
      .map((toolCall) => toolCall.id)
      .filter((id): id is string => id !== undefined),
  )
}

/**
 * Drop AIMessage/ToolMessage round-trips for the given tool names before
 * they're merged into the shared top-level thread history. Subgraphs like
 * the QA agent's testcase generation loop call the same tool dozens of times
 * (e.g. one `saveTestcase` round-trip per test case); those calls matter for
 * the subgraph's own reasoning but add no value to every other agent's
 * context once the subgraph is done, and left unchecked they make the shared
 * history (and therefore every future turn's request) grow without bound.
 * Only drops an AIMessage when *every* one of its tool_calls targets an
 * excluded tool name, so mixed-call messages are left untouched.
 */
export function excludeToolCallRoundtrips(
  messages: BaseMessage[],
  toolNames: readonly string[],
): BaseMessage[] {
  const result: BaseMessage[] = []
  let excludedIds: Set<string> | null = null

  for (const message of messages) {
    const isExpectedResponse =
      excludedIds &&
      isToolMessage(message) &&
      excludedIds.has(message.tool_call_id)

    if (isExpectedResponse) {
      excludedIds?.delete(message.tool_call_id)
      if (excludedIds?.size === 0) excludedIds = null
      continue
    }

    excludedIds = excludedToolCallIds(message, toolNames)
    if (excludedIds) continue

    result.push(message)
  }

  return result
}
