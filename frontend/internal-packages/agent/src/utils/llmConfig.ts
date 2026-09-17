// Reads OPENAI_API_KEY (via ChatOpenAI's own default) plus an optional
// OpenAI-compatible base URL and model name, so a DeepSeek (or any other
// OpenAI-compatible) endpoint can be used without touching call sites beyond
// swapping in these two exports.
export const LLM_MODEL = process.env['LLM_MODEL_NAME'] ?? 'gpt-5-mini'

const baseURL = process.env['OPENAI_BASE_URL']

// DeepSeek's v4-flash enables "thinking" (reasoning) mode by default. That
// breaks this codebase in two ways LangChain's OpenAI-shaped message classes
// don't account for: (1) DeepSeek rejects `tool_choice: "required"` while
// thinking is on ("400 Thinking mode does not support this tool_choice"),
// and (2) any multi-turn / checkpoint-replay call that resends a prior
// assistant tool-call message is rejected unless that message's
// `reasoning_content` is echoed back too ("400 The reasoning_content in the
// thinking mode must be passed back to the API") - something LangChain's
// AIMessage round-trip doesn't do. Disabling thinking mode sidesteps both;
// spread this into every ChatOpenAI that talks to a custom endpoint. Omitted
// entirely (rather than set to undefined) when no custom endpoint is
// configured, since ChatOpenAI's types reject an explicit
// `configuration: undefined`, and this is a no-op against real OpenAI
// models, which ignore unknown body fields.
export const LLM_CLIENT_CONFIG = baseURL
  ? {
      configuration: { baseURL },
      modelKwargs: { thinking: { type: 'disabled' } },
    }
  : {}
