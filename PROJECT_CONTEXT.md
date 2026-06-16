# Project Context

## Identity

- Product: RealEstateChatbot.ai
- Category: AI real estate chatbot for lead capture and appointment booking
- Core promise: Turn real estate traffic into qualified appointments 24/7.
- Remote workspace: `/home/ec2-user/realestatechatbot.ai`
- GitHub: `https://github.com/DhakalAsace/realestatechatbot.ai.git`
- Supabase project ref: `dwvkmxtumugvgytmlbsk`

## Current Goal

Phase 0 foundation through Phase 8 Billing, Entitlements, and Usage Limits are complete on AWS by automated checks, browser/Vercel preview verification, and sub-agent review. Phase 9 SEO and Product-Led Acquisition is implemented and in verification on AWS. Real Stripe checkout/portal/payment activation remains gated on test credentials, price IDs, and pricing decisions. The active planning file is `BUILD_PLAN.md`.

Current review target:

```text
Finish Phase 9 full verification, preview deployment, browser QA, docs finalization, and push; stop for payment activation, production promotion, secret rotation, or irreversible account-level changes
```

Latest verified preview:

```text
https://realestatechatbot-qnnce8o3f-dhakalasaces-projects.vercel.app
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
- OpenAI / Vercel AI SDK is active behind an opt-in `bot.ai_enabled` flag
- Structured outputs for AI runtime
- Controlled property/knowledge retrieval before AI reply generation
- Stripe test-mode billing is Phase 8; Supabase remains the app entitlement source of truth
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
- Deterministic validation
- Safety rules
- Eval fixtures
- AI disabled fallback

### Phase 4: Properties and Knowledge Base

- Workspace-scoped properties and knowledge documents
- RLS-protected dashboard CRUD
- Server-only retrieval in `/api/chat`
- Controlled property cards in chat
- No-invention fallback for unavailable property facts
- Anonymous, cross-tenant, archived-record, and browser e2e coverage

### Phase 5: Appointment Requests and Notifications

- Workspace-scoped appointment requests and notification outbox
- Buyer consultation, seller valuation, and showing request capture
- Calendar URL support from bot override or agent profile fallback
- Appointment dashboard and lead detail appointment panel
- Resend-ready notification helper with skipped/failed/sent state logging
- Transactional chat, lead, appointment, and outbox persistence through server-side RPC
- Anonymous, cross-tenant, notification-skip, and browser e2e coverage

### Phase 6: Teams, Brokerages, and Agencies

- Workspace settings dashboard
- Copy-link workspace invitations
- Owner/admin/agent/viewer roles
- Multiple agent and team profiles
- Bot assignment to agent/team profile
- Lead assignment and team inbox filters
- Appointment routing follows current lead assignment
- Audit events for membership/profile/assignment changes
- Owner-only owner role changes and locked last-owner guard
- Read-only viewer UI plus RLS mutation denial coverage

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
- AWS disk cleanup removed regenerable caches and old generated artifacts (`node_modules`, `.next`, package caches) from previous project workspaces. Disk must still be watched during builds because the root volume is small.
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
- Phase 2 plan was created in `PHASE_2_PLAN.md`. The core Phase 2 decisions are: use public channel keys instead of internal IDs, keep `bot_channels` as the channel source of truth, store normalized source fields for dashboard display, and build the website widget as an iframe-based embed for customer-site isolation.
- Phase 2 implementation added migration `202606110003_phase2_channels.sql`, channel labels/source fields, conversation/lead attribution fields, a channel-aware `/api/chat`, `/dashboard/channels`, public `/widget.js`, compact `/embed/[channelKey]`, QR SVG generation, lead source filters, dashboard source counts, and source details on lead detail pages.
- Phase 2 keeps public channel keys separate from private database IDs. Public hosted/campaign/social/QR URLs use `/c/[slug]?ch=[public_key]`; website snippets use `/widget.js?channel=[public_key]`; QR SVGs encode public channel URLs.
- Phase 2 widget position is bottom-right, widget color inherits the bot brand color, QR output is SVG, and active website widget channels require at least one allowed origin; empty origins fail closed.
- Supabase migration `202606110003_phase2_channels.sql` was pushed to project `dwvkmxtumugvgytmlbsk`.
- Phase 2 initial automated checks passed on AWS: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `npm run test:e2e`.
- Phase 2 closeout hardening added migration `202606150001_phase2_closeout_hardening.sql`: `record_chat_turn` RPC persists each chat turn transactionally and fails closed on Supabase write errors; lead/channel workspace integrity is enforced by trigger.
- Widget origin restrictions now use server-issued signed widget tokens. `/widget.js` issues a short-lived token only for an allowed origin, `/embed/[channelKey]` requires that token, and `/api/chat` rejects widget messages without a valid matching token/source origin.
- Hosted /c/[slug] pages parse UTM query params and pass attribution into chat. Widget launcher color inherits the bot brand color. QR SVG generation is authenticated and restricted to active qr_code channels for active bots.
- Channel manager now has real copy/open/download UI for hosted/campaign/social/QR URLs, widget snippets, and QR SVGs.
- Phase 2 Playwright coverage verifies Phase 1 regression paths plus campaign attribution, widget token allow/deny behavior, direct embed denial without token, local allowed-origin widget launcher/iframe rendering, embedded widget seller flow, QR SVG restrictions, disabled channel rejection, lead/channel integrity, lead source filters, and cross-tenant lead isolation.
- Phase 2 closeout verification passed on AWS on 2026-06-16: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `npm run test:e2e`.
- Phase 2 acceptance cleanup on 2026-06-16 restored disk headroom, removed `.codex-home/tmp`, added UTM term display on lead detail, made disabled channel cards stop promoting open/copy/download/QR actions, removed the six-channel lead filter cap, and updated stale `BUILD_PLAN.md` Current Next Step text.
- Acceptance cleanup test evidence passed on AWS: npm run lint, npm run typecheck, npm run test (4 files, 15 tests), npm run build, npm run test:bundle-secrets, and npm run test:e2e (4 Chromium tests).
- Expanded Phase 2 e2e evidence now covers lead detail term attribution, draft bot rejection, swapped slug/channel rejection, disabled channel inactive UI, empty widget-origin denial, active-bot QR restrictions, all-channel filters beyond six channels, widget token checks, lead/channel integrity, and stale dev server prevention.
- Fresh acceptance cleanup preview deployed at https://realestatechatbot-zqomfi5he-dhakalasaces-projects.vercel.app. Vercel inspect status: Ready. `vercel logs --since 15m` returned no runtime logs.
- Disk cleanup removed generated build/test artifacts and regenerable npm/Puppeteer/pnpm caches while keeping project dependencies and Playwright browsers. After final cleanup, root disk was about 77% used with about 7.1 GB free.

- 2026-06-16: User removed manual acceptance gates moving forward. Use automated checks, browser QA, and multiple sub-agent reviews as the acceptance gate; still stop for credentials, payment, production promotion, secret rotation, destructive actions, or irreversible external changes.
- 2026-06-16: Phase 2 marked complete by autonomous/sub-agent review after lint, typecheck, unit tests, build, bundle-secret scan, e2e, Vercel preview deploy, inspect, logs check, docs cleanup, and disk cleanup.

- 2026-06-16: Phase 3 AI runtime completed. Added `ai` and `@ai-sdk/openai`, migration `202606160001_phase3_ai_runtime.sql`, `bot.ai_enabled`, dashboard AI toggle, server-only AI reply enrichment, structured output schema, safety prompt, no-invention/legal/tax/mortgage/fair-housing fallback behavior, prompt contact redaction, deterministic state ownership, and bot-message AI metadata.
- Phase 3 keeps OpenAI non-streaming for now so `/api/chat` only returns after the transactional `record_chat_turn` RPC succeeds. AI can only replace the natural-language reply and safety metadata; it cannot write lead fields, IDs, scores, status, workspace, bot, channel, or conversation data.
- Phase 3 test evidence passed on AWS: `npm run lint`, `npm run typecheck`, `npm run test` (5 files, 21 tests), `npm run build`, `npm run test:bundle-secrets`, and `npm run test:e2e` (5 Chromium tests).
- Phase 3 Supabase migration was pushed to project `dwvkmxtumugvgytmlbsk`. Fresh Phase 3 preview deployed at https://realestatechatbot-9lw7zff2r-dhakalasaces-projects.vercel.app; Vercel inspect status Ready; authenticated Vercel curl verified `/` and `/c/sarah-patel`; recent logs showed only 200 responses.
- 2026-06-16: Phase 4 Properties and Knowledge Base completed. Added migration `202606160002_phase4_properties_knowledge.sql`, RLS-protected `properties` and `knowledge_documents`, dashboard `/dashboard/properties` and `/dashboard/knowledge`, server-only retrieval inside `/api/chat`, controlled property cards in hosted/widget chat, AI grounding with property/knowledge context, archived-record exclusion, and no-invention fallback when no matching controlled property exists.
- Phase 4 test evidence passed on AWS: `npm run lint`, `npm run typecheck`, `npm run test` (6 files, 25 tests), `npm run build`, `npm run test:bundle-secrets`, and `npm run test:e2e` (6 Chromium tests). Fresh Phase 4 preview deployed, inspected, and smoke-verified at https://realestatechatbot-mw0otco93-dhakalasaces-projects.vercel.app.
- 2026-06-16: Phase 5 Appointment Requests and Notifications completed. Added migration `202606160003_phase5_appointments.sql`, RLS-protected `appointments` and `notification_events`, calendar URL support on agent profiles and bot appointment config, deterministic buyer consultation/seller valuation/showing request capture, transactional chat/lead/appointment/outbox RPC, Resend-ready notification helper, `/dashboard/appointments`, lead detail appointment panel, and bot settings calendar fields.
- Phase 5 test evidence passed on AWS: `npm run lint`, `npm run typecheck`, `npm run test` (8 files, 38 tests), `npm run build`, `npm run test:bundle-secrets`, and `npm run test:e2e` (7 Chromium tests). Fresh Phase 5 preview deployed, inspected, and smoke-verified at https://realestatechatbot-auanq4p2b-dhakalasaces-projects.vercel.app.
- Real email delivery remains deferred until a Resend API key or preferred email provider plus sender domain/from-address decision is supplied. Missing credentials are recorded as skipped notifications and do not block lead or appointment creation.
- 2026-06-16: Phase 6 Teams, Brokerages, and Agencies completed. Added migrations `202606160004_phase6_teams.sql`, `202606160005_phase6_routing_profiles.sql`, `202606160006_phase6_membership_hardening.sql`, and `202606160007_phase6_owner_and_appointment_routing.sql`; `/dashboard/team`; `/invite/[token]`; copy-link invites; owner/admin/agent/viewer roles; multiple agent/team profiles; bot assignment; lead assignment/team inbox filters; audit events; owner-only owner changes; locked last-owner guard; appointment routing from current assigned profile; and viewer read-only UI.
- Phase 6 test evidence passed on AWS: `npm run lint`, `npm run typecheck`, `npm run test` (8 files, 38 tests), `npm run build`, `npm run test:bundle-secrets`, and `npm run test:e2e` (8 Chromium tests). Fresh Phase 6 preview deployed, inspected, and smoke-verified at https://realestatechatbot-gzhe5q504-dhakalasaces-projects.vercel.app.
- 2026-06-16: Phase 7 Email Follow-Up Automation implemented. Added follow-up sequence/message/state/preference tables, hashed-token unsubscribe, secured `/api/follow-ups/run`, Vercel cron config, dashboard `/dashboard/follow-ups`, lead-detail consent attestation/suppression, disabled-delivery logging, and Phase 7 e2e coverage.


- Phase 7 hardening after sub-agent review: scheduler now fails closed if unsubscribe token persistence fails before send; notification event insert failures no longer mark delivery states complete/skipped/failed as if logged; missing explicit consent uses `pending_consent`; consent attestation metadata records actor, timestamp, and consent text version; dashboard copy now distinguishes disabled/missing/ready email delivery config.
- Phase 7 test evidence passed on AWS: `npm run lint`, `npm run typecheck`, `npm run test` (9 files, 45 tests), `npm run build`, `npm run test:bundle-secrets`, and `npm run test:e2e` (9 Chromium tests).
- Fresh Phase 7 preview deployed at https://realestatechatbot-rmwjw3ifn-dhakalasaces-projects.vercel.app. Vercel inspect status: Ready. Authenticated Vercel curl verified `/` Phase 7 review copy and `/c/sarah-patel` hosted assistant rendering; recent logs showed no runtime errors.
- Real follow-up email delivery remains disabled unless `FOLLOW_UP_EMAIL_ENABLED=true` and provider env vars are configured. Before production promotion with cron enabled, set `CRON_SECRET` and finalize sender domain/from-address and consent wording.
- Phase 7 is complete by autonomous/sub-agent review.
- 2026-06-16: Phase 7 product buildout through Phase 7 was committed and pushed to GitHub branch `phase-1-hosted-chatbot` as commit `ceeeae9`.
- 2026-06-16: Phase 8 planning completed with two sub-agent reviews. Decision: build entitlement-first billing in Stripe test mode. Stripe handles Checkout, Portal, invoices, and subscription lifecycle events; Supabase remains the local entitlement/usage source of truth. Phase 8 starts with fixed plan limits, internal usage metering, server-side entitlement checks, webhook signature verification/idempotency, and a billing dashboard.
- Phase 8 should not include production payment launch, usage-based Stripe metered billing, coupons/discounts/affiliates, reseller billing, multi-currency/tax/refund flows, public pricing SEO pages, or an internal admin billing console.
- Phase 8 implementation can start with non-Stripe entitlement/database/UI scaffolding, but real checkout and webhook activation require Stripe test credentials, test price IDs or permission to create them, and initial plan/limit decisions.
- 2026-06-16: Phase 8 Billing, Entitlements, and Usage Limits implemented. Added Stripe SDK, billing data model/RLS, plan catalog, `/dashboard/billing`, owner/admin Checkout and Portal actions that fail closed without Stripe env, signed `/api/stripe/webhook`, normalized subscription handling, webhook failed-event retry/dedupe, usage events/rollups, atomic `reserve_usage_event` RPC, and DB triggers for bots, channels, team seats, properties, and knowledge limits.
- Phase 8 hardening after sub-agent review: chat/AI/follow-up usage now reserves atomically before costly work; public chat fails closed on usage reservation errors/limits; follow-up delivery skips disabled/misconfigured sends before metering but reserves before actual provider send; webhook signature verification no longer depends on `STRIPE_SECRET_KEY`; resource-limit trigger runs as security definer; subscription attribution checks existing Stripe customer/workspace ownership.
- Phase 8 test evidence passed on AWS: `npm run lint`, `npm run typecheck`, `npm run test` (12 files, 57 tests), `npm run build`, `npm run test:bundle-secrets`, targeted Phase 7+8 Playwright specs, and `npm run test:e2e` (10 Chromium tests covering Phases 1-8).
- Phase 8 Supabase migrations pushed to project `dwvkmxtumugvgytmlbsk`: `202606160010_phase8_billing.sql`, `202606160011_phase8_billing_limit_hardening.sql`, `202606160012_phase8_billing_limit_hardening_reapply.sql`, and `202606160013_phase8_resource_limit_security_definer.sql`.
- Fresh Phase 8 preview deployed at https://realestatechatbot-qnnce8o3f-dhakalasaces-projects.vercel.app. Vercel inspect status Ready. Authenticated Vercel curl verified `/` and `/c/sarah-patel`.
- Real Stripe payment activation remains pending test-mode credentials, webhook secret/endpoint setup, plan prices/price IDs, trial policy, and final billing copy. Production payment launch remains out of scope until explicitly approved.
- 2026-06-16: Phase 9 SEO and Product-Led Acquisition implemented on AWS. Added a canonical marketing homepage, shared marketing content map, required SEO pages, interactive real estate chatbot template generator, page-specific metadata/canonicals, generated OG image, SoftwareApplication JSON-LD, FAQ/WebPage JSON-LD, sitemap, robots, marketing unit tests, and Phase 9 Playwright coverage.
- Phase 9 route set: `/tools/real-estate-chatbot-template-generator`, `/examples/real-estate-chatbot-examples`, `/guides/how-to-build-a-real-estate-chatbot`, `/guides/real-estate-lead-capture`, `/use-cases/home-valuation-chatbot`, `/use-cases/open-house-chatbot`, `/use-cases/property-recommendation-chatbot`, and `/best-real-estate-chatbots`.
- Phase 9 keeps customer bot/embed pages noindex; sitemap includes only the public marketing/acquisition pages, not `/c/[slug]` customer bot pages.
- Phase 9 targeted evidence passed on AWS before full closeout: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and `npx playwright test tests/e2e/phase9-seo.spec.ts`.
- Phase 9 sub-agent audits were useful for checklist discovery but not authoritative because sub-agents could not mount the AWS path and audited a stale local mirror. Main-agent SSH inspection and test output from `/home/ec2-user/realestatechatbot.ai` are authoritative.
- Phase 9 closeout hardening fixed duplicate title-suffix metadata on the template generator page and added a regression test so non-homepage titles do not include the site suffix twice.
- Phase 9 Playwright was hardened to build first and run e2e against production `next start` rather than `next dev`, after a Turbopack dev-server panic killed a full regression run.
- Phase 9 final evidence passed on AWS: `npm run lint`, `npm run typecheck`, `npm run test` (13 files, 63 tests), `npm run build`, `npm run test:bundle-secrets`, and `npm run test:e2e` (14 Chromium tests).
- Fresh Phase 9 preview deployed at https://realestatechatbot-gbomiktfq-dhakalasaces-projects.vercel.app. Vercel inspect status Ready. Authenticated `vercel curl` verified homepage/subpage metadata, robots, sitemap, OG image PNG headers, and hosted bot noindex behavior; recent error-log scan returned no logs.
- In-app Browser attempted the protected preview and hit Vercel login. Because the preview is protected and the Vercel connector could not mint a bypass URL, authenticated Vercel CLI live checks plus Playwright browser tests are the authoritative browser/live evidence.
- Phase 9 is complete by autonomous/browser/sub-agent review. Production promotion is not done.

## Open Questions

- Which domain will be attached first: `realestatechatbot.ai`, a Vercel preview URL, or both?
- Should the unused generated deploy key be removed, or kept as a fallback option?
- Manual acceptance gates are removed by user instruction; continue with automated, browser, and sub-agent review unless a risky external action requires approval.
- Phase 8 implementation is complete, but real Stripe test mode activation still needs:
  - Stripe test secret key.
  - Stripe test publishable key.
  - Stripe webhook signing secret for the Vercel preview endpoint or Stripe CLI forwarding.
  - Initial plan names, monthly prices, and limits.
  - Stripe test price IDs for selected plans, or permission for Codex to create them in Stripe test mode after account access is configured.
  - Trial policy, if any.
  - `past_due` behavior: grace period, block AI only, or block new public chat/paid actions.

## Manual Test Log

Phase 1 automated checks passed on AWS. Google sign-in was verified end-to-end on a review preview and the Sarah Patel hosted bot page loads at `/c/sarah-patel`. Browser buyer/seller lead-capture review passed, dashboard/lead transcript behavior passed through Playwright and browser+DB verification, and mobile hosted-bot smoke passed. Phase 1 is complete.

Phase 2 acceptance cleanup automated review passed on AWS. The app can create campaign/widget/QR channels, generate public channel URLs/snippets/QR SVGs, enforce signed widget origin tokens, complete public hosted and embedded chat flows, persist source attribution including UTM term, hide/prominently inactivate disabled channel share actions, and keep all channel filters visible. Fresh Phase 2 preview deployed at https://realestatechatbot-zqomfi5he-dhakalasaces-projects.vercel.app. Manual acceptance gate was removed by user instruction on 2026-06-16; Phase 2 is complete by autonomous/sub-agent review.

Phase 3 automated/sub-agent review passed on AWS. AI-assisted replies are available behind the bot settings toggle, deterministic lead state remains the source of truth, safety fallbacks prevent legal/tax/mortgage/fair-housing/property-fact invention paths, and AI metadata is stored in bot message JSON. Phase 4 automated/sub-agent review also passed: dashboard property/knowledge CRUD, controlled retrieval, property cards, no-invention fallback, archived-record exclusion, anonymous denial, and cross-tenant denial are covered by unit and Playwright tests. Phase 5 automated/sub-agent review passed: buyer consultation, seller valuation, showing request, appointment dashboard, lead detail panel, calendar URL, skipped notification logging, anonymous denial, and cross-tenant denial are covered by unit and Playwright tests. Fresh Phase 5 preview deployed at https://realestatechatbot-auanq4p2b-dhakalasaces-projects.vercel.app; inspect status Ready; authenticated Vercel curl verified `/` and `/c/sarah-patel`; recent logs showed only 200 responses. Phase 6 automated/sub-agent review passed: workspace settings, copy-link invites, owner/admin/agent/viewer roles, team profiles, bot routing, team inbox filters, lead reassignment, appointment routing after reassignment, audit events, viewer read-only UI, anonymous denial, direct mutation denial, audit spoof denial, and last-owner guard are covered. Fresh Phase 6 preview deployed at https://realestatechatbot-gzhe5q504-dhakalasaces-projects.vercel.app. Phase 7 automated/sub-agent review passed and fresh Phase 7 preview deployed at https://realestatechatbot-rmwjw3ifn-dhakalasaces-projects.vercel.app. Phase 8 automated/sub-agent review passed and fresh Phase 8 preview deployed at https://realestatechatbot-qnnce8o3f-dhakalasaces-projects.vercel.app. Billing data/RLS, dashboard, signed webhooks, atomic usage reservations, and DB resource-limit triggers are in place. Real Stripe checkout/portal/payment activation remains pending test credentials and price IDs. Phase 9 automated/browser/sub-agent review passed and fresh Phase 9 preview deployed at https://realestatechatbot-gbomiktfq-dhakalasaces-projects.vercel.app. SEO homepage/pages, metadata, schema, sitemap, robots, OG image, template generator, noindex customer-bot behavior, and full regression are complete. Production promotion is not done.
