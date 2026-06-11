# Project Context

## Identity

- Product: RealEstateChatbot.ai
- Category: AI real estate chatbot for lead capture and appointment booking
- Core promise: Turn real estate traffic into qualified appointments 24/7.
- Remote workspace: `/home/ec2-user/realestatechatbot.ai`
- GitHub: `https://github.com/DhakalAsace/realestatechatbot.ai.git`
- Supabase project ref: `dwvkmxtumugvgytmlbsk`

## Current Goal

Phase 0 foundation and Phase 1 hosted chatbot loop are complete. The active planning file is `BUILD_PLAN.md`.

Next, build Phase 2:

```text
one bot can be shared through hosted links, website widgets, QR codes, social/campaign links -> source is tracked on conversations/leads
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
- `BUILD_PLAN.md`
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
- `BUILD_PLAN.md` was created as the durable phase-by-phase checklist and user review gate.
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

- Phase 1 implementation added Supabase migrations, SSR auth, protected dashboard, hosted `/c/[slug]` bot route, deterministic buyer/seller chat, lead scoring, transcript storage, and lead inbox/detail pages.
- Supabase migration `202606100001_phase1_core.sql` was pushed to project `dwvkmxtumugvgytmlbsk`.
- Supabase CLI verified all eight Phase 1 tables have RLS enabled: workspaces, workspace_members, agent_profiles, bots, bot_channels, conversations, messages, leads.
- Vercel env vars were set for Production, Preview, and Development: Supabase URL, publishable key, server-only key, project ref, chat token secret. OpenAI key remains present but unused.
- The server-only Supabase key uses the project service_role-compatible key because the public chat ingestion route must bypass RLS on the server while never exposing that key to the browser.
- Automated checks passed: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Temporary end-to-end smoke test passed: disposable workspace/bot -> `POST /api/chat` buyer flow -> qualified lead -> 16 transcript messages -> cleanup.
- Cross-workspace RLS smoke test passed: user A can read own workspace, cannot read workspace B, and cannot mutate workspace B bot.
- Chrome browser automation is available from the local Codex app when the Codex Chrome Extension is connected. Use AWS SSH for builds, Supabase/Vercel CLI, and heavy checks to avoid loading the laptop.

- Auth pivot: magic-link UI was removed after repeated Supabase default-email/PKCE friction. Phase 1 now uses email/password plus planned Google OAuth through Supabase.
- Supabase Auth config was updated for password auth: signups enabled, email auto-confirm enabled for Phase 1, and minimum password length set to 8. Revisit email confirmation/custom SMTP before public launch.
- Google OAuth uses the server callback `/auth/callback`; Supabase OAuth provider is configured with a Google Cloud web client. Required Google redirect URI: `https://dwvkmxtumugvgytmlbsk.supabase.co/auth/v1/callback`.
- Google Cloud OAuth was configured and verified through Chrome control under `dhakalasace777@gmail.com`. The OAuth client includes the production origin, the latest Vercel preview origin, and Supabase callback redirect URI.
- Supabase migration `202606110001_allow_workspace_creator_bootstrap_select.sql` fixes first-workspace bootstrap by allowing authenticated workspace creators to read the workspace row before owner membership exists. Disposable RLS onboarding smoke test passed, and the real `dhakalasace777@gmail.com` onboarding created the Northline Realty / Sarah Patel sample bot.
- Phase 1 default workspace decision: signup alone does not create workspace data. Onboarding creates the first workspace, owner membership, agent profile, active bot, and hosted channel.
- Supabase migration `202606110002_atomic_onboarding_rpc.sql` adds `public.complete_workspace_onboarding(...)` so onboarding is transactional. Duplicate bot slug now rolls back instead of leaving partial workspace/profile rows.
- Duplicate hosted slug handling now shows a clear onboarding/settings UI error and suggests an alternate slug during onboarding.
- Public chat conversations/messages can exist before contact capture, but lead rows are only created after a valid email or phone is captured. This keeps invalid-contact experiments out of the lead inbox.
- Playwright Phase 1 e2e coverage was added. It verifies logged-out dashboard protection, email/password account setup, onboarding-created default workspace/bot, public buyer flow, public seller flow, lead inbox/detail transcript, score/status, invalid slug 404, invalid contact no-lead behavior, duplicate slug rollback, and RLS isolation.
- `npm run test:e2e` passed on AWS with 3 Chromium tests.
- Verification hardening preview deployed on Vercel: `https://realestatechatbot-r8ro5equ5-dhakalasaces-projects.vercel.app`.
- Vercel inspect status: Ready. Protected-preview `vercel curl` verified `/c/sarah-patel` renders the hosted Sarah Patel assistant. Error log scan for the preview returned no errors.
- Phase 1 final re-verification passed on AWS: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, and `npm run build`.
- Browser-use verification through an SSH tunnel to the AWS production server completed buyer and seller flows against `/c/sarah-patel`; Supabase confirmed qualified/hot leads with transcript messages and score 100. Temporary browser test records were deleted.
- Mobile smoke review passed at a 390px viewport for the hosted Sarah Patel bot: assistant content, buy button, and input rendered with no console errors.
- Phase 1 is accepted as complete. Next phase is Phase 2: Widget, QR, and Channel Tracking.

## Open Questions

- Which domain will be attached first: `realestatechatbot.ai`, a Vercel preview URL, or both?
- Should the unused generated deploy key be removed, or kept as a fallback option?

## Manual Test Log

Phase 1 automated checks passed on AWS. Google sign-in was verified end-to-end on a review preview and the Sarah Patel hosted bot page loads at `/c/sarah-patel`. Browser buyer/seller lead-capture review passed, dashboard/lead transcript behavior passed through Playwright and browser+DB verification, and mobile hosted-bot smoke passed. Phase 1 is complete.
