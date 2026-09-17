<h1 align="center">
  <img src="./frontend/apps/app/app/icon.svg" alt="Bongo DB" width="72">
  <br>
  Bongo DB
</h1>

<h2 align="center">
  Automatically generates beautiful and easy-to-read ER diagrams from your database.
</h2>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache%202-blue" /></a>
</p>

## What's Bongo DB?

Bongo DB is a personal fork of [Liam ERD](https://github.com/liam-hq/liam), a tool that generates beautiful, interactive ER diagrams from your database and lets you iterate on schema design through a multi-agent chat workflow.

- **Beautiful UI & Interactive**: A clean design and intuitive features (like panning, zooming, and filtering) make it easy to understand even the most complex databases.
- **Simple Reverse Engineering**: Seamlessly turn your existing database schemas into clear, readable diagrams.
- **Multi-Agent Design Workflow**: A PM/DB/QA/Lead agent pipeline analyzes requirements, proposes schema changes, generates and runs test cases, and summarizes what happened.
- **Follow-Up Chat**: Keep iterating on a design session instead of starting a new one for every change.

## What's different from upstream Liam ERD

This fork runs its own deployment rather than the public liambx.com service, with a few changes on top of upstream:

- **DeepSeek instead of OpenAI** as the LLM backend (`frontend/internal-packages/agent/src/utils/llmConfig.ts`), with reasoning/"thinking" mode explicitly disabled for tool-calling compatibility.
- **Follow-up chat**: upstream Liam ERD runs each design session as a single one-shot prompt; this fork adds a chat input so a session can keep going (`frontend/apps/app/components/SessionDetailPage/components/ChatInput/`).
- **Bounded session history**: the QA agent's per-test-case tool calls are excluded from the shared thread history after each run (`excludeToolCallRoundtrips` in `frontend/internal-packages/agent/src/utils/messageCleanup.ts`), so long-running sessions don't grow past the model's context window.
- **Rebranded**: logo, product name, and accent color (brass, replacing Liam's green) throughout the app UI.

## Running this fork

This fork is intended to be self-hosted rather than installed from a published package. At a high level:

```bash
git clone <this-repo-url>
cd bongo
pnpm install
cp .env.template .env   # fill in your own Supabase and DeepSeek/OpenAI-compatible API credentials
pnpm --filter @liam-hq/app build
pnpm --filter @liam-hq/app start
```

See [CLAUDE.md](CLAUDE.md) for day-to-day development commands.

## License

Bongo DB is licensed under the [Apache License Version 2.0](LICENSE), the same license as the upstream project it's forked from ([liam-hq/liam](https://github.com/liam-hq/liam)).

Licenses for third-party packages can be found in [docs/packages-license.md](docs/packages-license.md).
