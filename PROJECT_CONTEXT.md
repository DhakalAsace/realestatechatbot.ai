# Project Context

## Identity

- Product: RealEstateChatbot.ai
- Category: AI real estate chatbot for lead capture and appointment booking
- Core promise: Turn real estate traffic into qualified appointments 24/7.
- Remote workspace: `/home/ec2-user/realestatechatbot.ai`
- GitHub: `https://github.com/DhakalAsace/realestatechatbot.ai.git`
- Supabase project ref: `dwvkmxtumugvgytmlbsk`

## Current Goal

Set up the remote-only foundation, then build the first vertical slice:

```text
agent creates a bot -> visitor completes buyer/seller chat -> lead appears in dashboard with transcript and score
```

## Development Rules

- Keep work on AWS, not on the laptop.
- Use only the dedicated GitHub repo for this project.
- Use only the dedicated Supabase project ref listed above.
- Use Vercel CLI only from this project directory after confirming the linked project.
- Record important decisions and manual test results in this file.

## Architecture Direction

- Next.js App Router hosted on Vercel
- Supabase Auth, Postgres, RLS, and Storage
- App-owned workflow state and authorization
- OpenAI / Vercel AI SDK later, after the deterministic hosted chat loop works
- Structured outputs and tool calling for AI runtime
- No Agents SDK in v1
- No MLS/IDX in v1
- No SMS/WhatsApp in v1
- Stripe after product value is proven

## Milestones

### Phase 0: Foundation

- Remote AWS folder
- GitHub repo connected
- Project-scoped Codex/Supabase MCP setup
- Vercel CLI setup
- Next.js app scaffold
- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- Environment variable template

### Phase 1: Hosted Chatbot Product Loop

- Auth
- Workspace
- Agent profile
- Bot configuration
- Hosted public bot page
- Deterministic buyer/seller lead flow
- Lead dashboard
- Conversation transcript
- Lead score and status

### Phase 2: Channels

- Website widget
- QR/channel tracking
- Campaign source attribution

### Phase 3: AI Runtime

- Structured output schema
- Tool definitions
- Deterministic validation
- Safety rules
- Eval fixtures
- AI disabled fallback

## Decisions

### 2026-06-10

- Use remote AWS dev box for this project to avoid loading the laptop.
- Use GitHub repo `DhakalAsace/realestatechatbot.ai`.
- Use Supabase project `dwvkmxtumugvgytmlbsk`.
- Keep Supabase MCP isolated in project Codex config/profile instead of modifying other project MCP entries.
- Build vertical slices instead of backend-first, UI-first, or SEO-first.
- Vercel CLI is authenticated on AWS as `dhakalasace`.
- Vercel should be linked under the personal `dhakalasace` account, not a team.
- GitHub CLI was installed project-locally under `.codex-home/bin/gh`.
- GitHub OAuth completed as `DhakalAsace` using project-local `GH_CONFIG_DIR=.codex-home/gh`.
- Git pushes use HTTPS with a project-local Git credential helper, not the older deploy key from another repo.
- Supabase agent skills were installed project-level under `.agents/skills`.
- Supabase MCP OAuth completed successfully through the isolated `.codex-home` profile.
- Next.js App Router was scaffolded with npm, TypeScript, Tailwind CSS, ESLint, and a first static product shell.
- Vercel project linked and connected to GitHub: `dhakalasaces-projects/realestatechatbot-ai`.
- Vercel project id: `prj_lbsOq5VKQWNU5QpUQdCxHdd6EFip`.
- Vercel org id: `team_hogI923v7Y0q0Isem7OqbioE`.
- First production deployment succeeded.
- Production URL: `https://realestatechatbot-ai.vercel.app`.
- `OPENAI_API_KEY` is stored in AWS `.env.local` and Vercel Production, Preview, and Development environment variables. Do not commit or print the value. Rotate before public launch.
- `npm run lint` passed.
- `npm run build` passed locally and on Vercel.
- AWS disk cleanup removed regenerable caches and old generated artifacts (`node_modules`, `.next`, package caches) from previous project workspaces. Root volume is now about 62% used with about 12 GB free.
- `npm install` reports 2 moderate audit findings in generated dependencies. Review before launch-hardening.

## Open Questions

- Which domain will be attached first: `realestatechatbot.ai`, a Vercel preview URL, or both?
- Should the unused generated deploy key be removed, or kept as a fallback option?

## Manual Test Log

No product tests yet. Foundation setup is in progress.
