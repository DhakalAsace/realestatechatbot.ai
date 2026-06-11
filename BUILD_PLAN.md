# Build Plan

RealEstateChatbot.ai is a real-estate-specific AI lead conversion assistant, not a generic chatbot builder.

The product promise is:

```text
Turn real estate traffic into qualified appointments 24/7.
```

The first real milestone is:

```text
agent creates a bot -> visitor completes hosted buyer/seller chat -> lead appears in dashboard with transcript and score
```

## Collaboration Loop

For every phase:

- [ ] Codex confirms the exact scope before building.
- [ ] Codex builds on the AWS dev box only.
- [ ] Codex updates this checklist as work progresses.
- [ ] Codex updates `PROJECT_CONTEXT.md` with decisions, credentials status, environment notes, and manual test results.
- [ ] Codex runs relevant automated checks.
- [ ] Codex deploys to Vercel when the phase is ready for review.
- [ ] Codex gives the user a short review guide with URLs and test steps.
- [ ] User reviews the live app and reports changes.
- [ ] Codex fixes review feedback.
- [ ] Phase is marked complete only after automated checks and user review are both acceptable.

## Always-On Constraints

- [ ] Work happens on AWS in `/home/ec2-user/realestatechatbot.ai`.
- [ ] Use only GitHub repo `DhakalAsace/realestatechatbot.ai`.
- [ ] Use only Supabase project ref `dwvkmxtumugvgytmlbsk`.
- [ ] Use Vercel only from this project directory.
- [ ] Do not commit secrets.
- [ ] Do not expose service-role keys to the browser.
- [ ] Keep RLS and server-side authorization central.
- [ ] Do not build MLS/IDX in v1.
- [ ] Do not build SMS/WhatsApp before consent/opt-out design.
- [ ] Do not add Stripe before the core product loop works.
- [ ] AI must not invent property facts.
- [ ] AI must not provide legal, tax, mortgage, or financial advice.

## Phase 0: Foundation

Goal: create the remote-only development foundation.

- [x] Create AWS project folder.
- [x] Initialize Git repo.
- [x] Connect GitHub repo.
- [x] Configure project-isolated GitHub auth.
- [x] Configure project-isolated Supabase MCP.
- [x] Authenticate Supabase MCP with OAuth.
- [x] Install Supabase agent skills project-level.
- [x] Link Vercel project under personal `dhakalasace` account.
- [x] Connect Vercel to GitHub repo.
- [x] Store OpenAI key in AWS `.env.local`.
- [x] Store OpenAI key in Vercel Production, Preview, and Development env vars.
- [x] Scaffold Next.js App Router app.
- [x] Deploy first production build.
- [x] Verify production URL responds.
- [x] Clean AWS disk enough for development.
- [x] Create `AGENTS.md`.
- [x] Create `PROJECT_CONTEXT.md`.
- [x] Create `BUILD_PLAN.md`.

Review URL:

```text
https://realestatechatbot-ai.vercel.app
```

Phase 0 status: complete.

## Phase 1: Hosted Chatbot Product Loop

Goal: build the first real product loop.

```text
agent signs in -> creates profile and bot -> visitor chats on hosted link -> lead appears in dashboard
```

### Build

- [x] Supabase migration structure.
- [x] Supabase SSR client setup for Next.js.
- [x] Auth pages and callbacks.
- [x] Protected dashboard shell.
- [x] Workspace creation for first user.
- [x] `workspaces` table with RLS.
- [x] `workspace_members` table with RLS.
- [x] `agent_profiles` table with RLS.
- [x] `bots` table with RLS.
- [x] `bot_channels` table with RLS.
- [x] `conversations` table.
- [x] `messages` table.
- [x] `leads` table.
- [x] Minimal agent profile form.
- [x] Minimal bot setup form.
- [x] Hosted public bot route at `/c/[slug]`.
- [x] Deterministic buyer lead flow.
- [x] Deterministic seller lead flow.
- [x] Lead scoring helper.
- [x] Conversation transcript storage.
- [x] Lead dashboard table.
- [x] Lead detail page with transcript.
- [x] Loading, empty, error, and success states.
- [x] Mobile-responsive layout pass in code.
- [x] Decision: "default workspace exists" means onboarding creates the first workspace, profile, bot, and hosted channel after signup.
- [x] Atomic onboarding RPC prevents partial workspace/profile data when bot slug creation fails.
- [x] Duplicate hosted slug shows a clear UI error and suggested alternate slug.
- [x] Incomplete chats without valid contact stay out of the lead inbox.

### Security

- [x] RLS enabled on all exposed workspace-owned tables.
- [x] Server-side authorization on every private query/mutation.
- [x] Public chat endpoint validates active bot/channel.
- [x] Public chat endpoint does not allow arbitrary workspace writes.
- [x] Basic public endpoint rate limit / abuse guard.
- [x] No service role key in browser bundle static asset scan.
- [x] Cross-workspace access smoke test.
- [x] Automated RLS e2e check confirms User B cannot read User A leads.

### Automated Checks

- [x] `npm run lint`.
- [x] `npm run typecheck`.
- [x] `npm run build`.
- [x] Unit tests for lead scoring and deterministic flow state.
- [x] Basic integration smoke test for public chat route against Supabase.
- [x] Supabase migration pushed to project `dwvkmxtumugvgytmlbsk`.
- [x] Supabase RLS/policy verification query.
- [x] Playwright config added.
- [x] Playwright happy path covers auth, onboarding, hosted buyer flow, hosted seller flow, lead inbox/detail, invalid slug, duplicate slug, invalid contact, and RLS isolation.

### Manual Review

- [x] Supabase Auth redirect allowlist confirmed in dashboard.
- [x] User can sign in.
- [x] User can create or complete workspace setup.
- [x] User can create an agent profile.
- [x] User can create a bot.
- [x] Hosted bot link loads.
- [x] Visitor completes buyer flow.
- [x] Visitor completes seller flow.
- [x] Dashboard shows captured lead.
- [x] Lead detail shows transcript.
- [x] Mobile review passes.

Need from user before/during Phase 1:

- [x] Confirm preferred auth providers for v1: email/password plus Google. Magic link removed.
- [x] Provide sample agent profile details for testing.
- [x] Confirm hosted bot URL pattern: `/c/[slug]`.

Phase 1 status: complete. Preview deployed, automated checks passed, browser buyer/seller flows verified, and manual review checklist accepted.

## Phase 2: Widget, QR, and Channel Tracking

Goal: let one bot appear across hosted links, website widgets, QR codes, and campaign links.

- [ ] Website widget script route.
- [ ] Embeddable widget loader.
- [ ] Widget configuration screen.
- [ ] QR/channel creation UI.
- [ ] `bot_channels` channel tracking by source.
- [ ] Campaign URL support.
- [ ] Leads show source/channel.
- [ ] Public customer bot pages are `noindex` by default.
- [ ] Automated checks pass.
- [ ] User reviews hosted link, widget, and QR/campaign source attribution.

Phase 2 status: pending.

## Phase 3: AI Runtime

Goal: add AI conversation while the app still owns state, writes, validation, and safety.

- [ ] Add Vercel AI SDK / OpenAI integration.
- [ ] Define structured output schema.
- [ ] Define deterministic tool contracts.
- [ ] Implement app-validated tools.
- [ ] Add `bot.ai_enabled` flag.
- [ ] Add AI safety prompt.
- [ ] Add no-invention property rule.
- [ ] Add legal/tax/mortgage advice safe response.
- [ ] Add fair-housing-sensitive response behavior.
- [ ] Store AI metadata, safety flags, latency, and token usage where available.
- [ ] Keep deterministic fallback working.
- [ ] Add eval fixtures for core scenarios.
- [ ] Automated checks pass.
- [ ] User reviews AI buyer/seller chat and safety behavior.

Phase 3 status: pending.

## Phase 4: Properties and Knowledge Base

Goal: let bots recommend agent-provided properties and answer from controlled knowledge.

- [ ] `properties` table and RLS.
- [ ] Property add/edit UI.
- [ ] Property image/file storage if needed.
- [ ] `knowledge_documents` table and RLS.
- [ ] Manual FAQ/document UI.
- [ ] Basic `search_properties`.
- [ ] Basic `search_knowledge`.
- [ ] Property cards in chat.
- [ ] Bot refuses to invent unavailable facts.
- [ ] Automated checks pass.
- [ ] User reviews property recommendation and knowledge answer flows.

Phase 4 status: pending.

## Phase 5: Appointment Requests and Notifications

Goal: turn qualified conversations into appointment, showing, or valuation requests.

- [ ] `appointments` table and RLS.
- [ ] Buyer consultation request flow.
- [ ] Seller valuation request flow.
- [ ] Showing request flow.
- [ ] Calendar URL support from agent profile or bot override.
- [ ] Appointment dashboard.
- [ ] Resend email notification setup.
- [ ] Notification failure does not block lead creation.
- [ ] Tests mock email sending.
- [ ] Automated checks pass.
- [ ] User reviews appointment request and notification flow.

Need from user:

- [ ] Resend API key or preferred email provider.
- [ ] Sender domain decision.

Phase 5 status: pending.

## Phase 6: Teams, Brokerages, and Agencies

Goal: make the app usable beyond solo agents.

- [ ] Workspace settings.
- [ ] Member invitations.
- [ ] Roles: owner, admin, agent, viewer.
- [ ] Multiple agent profiles.
- [ ] Bot assigned to agent/team profile.
- [ ] Basic lead routing.
- [ ] Team inbox.
- [ ] Permission tests.
- [ ] Audit events for membership changes.
- [ ] Automated checks pass.
- [ ] User reviews owner/admin/agent/viewer behavior.

Phase 6 status: pending.

## Phase 7: Email Follow-Up Automation

Goal: add safe email follow-up before SMS/WhatsApp.

- [ ] `follow_up_sequences` table.
- [ ] `follow_up_messages` table.
- [ ] `lead_follow_up_state` table.
- [ ] Email consent tracking.
- [ ] Unsubscribe link and opt-out tracking.
- [ ] Scheduled job endpoint.
- [ ] Default buyer no-booking follow-up.
- [ ] Default seller valuation follow-up.
- [ ] Default showing request follow-up.
- [ ] Dashboard controls.
- [ ] Sent/failed/skipped logs.
- [ ] Consent and opt-out tests.
- [ ] User reviews follow-up and unsubscribe behavior.

Phase 7 status: pending.

## Phase 8: Billing and Usage Limits

Goal: monetize after the product loop works.

- [ ] Stripe products/prices.
- [ ] `subscriptions` table.
- [ ] `usage_events` table.
- [ ] Checkout flow.
- [ ] Customer portal link.
- [ ] Stripe webhook verification.
- [ ] Server-side plan limit enforcement.
- [ ] Entitlement helper.
- [ ] Billing page.
- [ ] Usage meter.
- [ ] Webhook tests.
- [ ] User reviews subscribe, upgrade, limit, and cancel flows.

Need from user:

- [ ] Stripe account/test keys.
- [ ] Final initial plan/pricing decision.

Phase 8 status: pending.

## Phase 9: SEO and Product-Led Acquisition

Goal: build useful SEO/product pages after the product is real.

- [ ] Polish homepage as canonical money page.
- [ ] Add metadata and canonical tags.
- [ ] Add OG image strategy.
- [ ] Add SoftwareApplication schema.
- [ ] Add FAQ schema where appropriate.
- [ ] `/tools/real-estate-chatbot-template-generator`
- [ ] `/examples/real-estate-chatbot-examples`
- [ ] `/guides/how-to-build-a-real-estate-chatbot`
- [ ] `/guides/real-estate-lead-capture`
- [ ] `/use-cases/home-valuation-chatbot`
- [ ] `/use-cases/open-house-chatbot`
- [ ] `/use-cases/property-recommendation-chatbot`
- [ ] `/best-real-estate-chatbots`
- [ ] Sitemap and robots.
- [ ] No duplicate synonym pages.
- [ ] User reviews SEO pages and product CTAs.

Phase 9 status: pending.

## Phase 10: Hardening and Launch Readiness

Goal: make the app safe and solid enough for real agents.

- [ ] Rate limiting on public chat endpoints.
- [ ] Spam/abuse detection.
- [ ] Error logging.
- [ ] Vercel observability review.
- [ ] Audit log review UI.
- [ ] Internal admin dashboard.
- [ ] Lead export.
- [ ] Privacy policy.
- [ ] Terms.
- [ ] Acceptable use policy.
- [ ] AI disclaimer.
- [ ] Accessibility pass.
- [ ] Performance pass.
- [ ] Security checklist.
- [ ] AI eval regression suite.
- [ ] Rotate OpenAI key before public launch.
- [ ] User reviews launch checklist.

Phase 10 status: pending.

## Current Next Step

Start Phase 2: Widget, QR, and Channel Tracking.

Recommended first implementation slice:

```text
channel source model + hosted/campaign channel management UI + source attribution on leads
```

Then:

```text
embeddable website widget loader + QR/campaign links + lead source reporting
```


## Auth Pivot Addendum (2026-06-10)

Goal: replace fragile Supabase magic-link login with email/password plus Google OAuth.

- [x] Remove magic-link login UI.
- [x] Add email/password sign in and account creation.
- [x] Add Google OAuth button in the login UI.
- [x] Use Supabase server callback for Google OAuth code exchange.
- [x] Configure Supabase password auth for Phase 1: signups enabled, email auto-confirm enabled, password minimum 8 characters.
- [x] Create Google Cloud OAuth Web Client.
- [x] Configure Supabase Google provider with Google Client ID and Client Secret.
- [x] Add exact Google JavaScript origins for production/current review preview.
- [x] Deploy preview and manually test email/password and Google sign-in.

Required Google OAuth values:

```txt
Authorized redirect URI:
https://dwvkmxtumugvgytmlbsk.supabase.co/auth/v1/callback

Authorized JavaScript origins:
https://realestatechatbot-ai.vercel.app
https://<current-preview>.vercel.app
```
