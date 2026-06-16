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

- [ ] Codex confirms the exact scope from the source-of-truth docs before building.
- [ ] Codex builds on the AWS dev box only.
- [ ] Codex updates this checklist as work progresses.
- [ ] Codex updates `PROJECT_CONTEXT.md` with decisions, credentials status, environment notes, and verification results.
- [ ] Codex runs relevant automated checks.
- [ ] Codex uses browser QA and sub-agent/review passes for important product, security, and deployment checks.
- [ ] Codex deploys to Vercel when the phase is ready for preview verification.
- [ ] Codex fixes review findings before advancing.
- [ ] Phase is marked complete only after automated checks, browser/deploy verification, and autonomous/sub-agent review are acceptable.
- [ ] Stop and ask the user only for credentials, payment, production promotion, secret rotation, destructive external actions, or irreversible account-level changes.

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

Detailed plan: `PHASE_2_PLAN.md`.

### Phase 2A: Channel Data And Attribution

- [x] Add/extend channel types: hosted link, website widget, QR code, social link, campaign.
- [x] Add channel label/source fields without exposing private IDs.
- [x] Add lead/conversation source attribution fields needed for dashboard display.
- [x] Update onboarding RPC to create a labelled default hosted channel.
- [x] Update `/api/chat` to accept and validate `channelKey`.
- [x] Preserve source URL, referrer, and UTM data safely.
- [x] Reject disabled channels, draft bots, and mismatched bot/channel requests.
- [x] Hosted `/c/[slug]` links parse UTM query params and pass them into chat attribution.
- [x] Public chat persistence runs through `record_chat_turn` RPC so each turn fails closed on Supabase write errors.
- [x] `record_chat_turn` writes visitor message, bot message, conversation state, and lead data in one database transaction.
- [x] Lead/channel integrity trigger rejects mismatched workspace, bot, or channel updates.
- [x] Website widget channels require a server-issued signed widget token before `/embed/[channelKey]` or `/api/chat` accepts messages.
- [x] Widget origin restrictions are enforced by /widget.js, /embed/[channelKey], and /api/chat; active widget channels require explicit allowed origins and empty origin lists fail closed.
- [x] Show source/channel on lead inbox rows.
- [x] Show source/channel/referrer/UTM on lead detail.

### Phase 2B: Channel Manager

- [x] Add `/dashboard/channels`.
- [x] List all channels for the active bot/workspace.
- [x] Create hosted/campaign/social/QR/widget channels.
- [x] Edit channel label, status, source metadata, and widget allowed origins.
- [x] Copy hosted/campaign/social/QR URLs.
- [x] Copy widget embed snippet.
- [x] Add real copy/open/download UI for channel URLs, widget snippets, and QR SVGs.
- [x] Add source/channel filters to the lead inbox.

### Phase 2C: Website Widget

- [x] Add public `GET /widget.js` route returning safe JavaScript.
- [x] Add compact iframe chat route at `/embed/[channelKey]`.
- [x] Widget script injects a floating launcher and iframe.
- [x] Widget passes parent URL/referrer/UTM data to chat safely.
- [x] Widget inherits bot brand color.
- [x] Widget browser test verifies launcher/iframe rendering from an allowed local origin.
- [x] Widget security tests verify denied origins, missing tokens, bad source URLs, and direct embed without token fail closed.

### Phase 2D: QR And Reporting

- [x] Generate QR code for QR channels.
- [x] QR SVG route is authenticated and only serves active qr_code channels for active bots.
- [x] QR encodes public channel URL, not private DB IDs.
- [x] Dashboard shows source/channel counts.
- [x] Public customer bot/embed pages are `noindex` by default.
- [x] Automated checks pass.
- [x] Browser tests cover hosted channel, campaign link, widget token enforcement, empty widget-origin denial, QR route restrictions, active-bot QR checks, source filters, disabled channel, lead/channel integrity, and cross-tenant access.
- [x] Lead detail shows UTM term attribution.
- [x] Disabled channels clearly show inactive state and stop promoting open/copy/download/QR actions.
- [x] Lead inbox channel filters render all workspace channels instead of only the first six.
- [x] Autonomous review accepts hosted link, widget, and QR/campaign source attribution per user instruction.

### Phase 2 Closeout Verification

- [x] `npm run lint`.
- [x] `npm run typecheck`.
- [x] `npm run test`.
- [x] `npm run build`.
- [x] `npm run test:bundle-secrets`.
- [x] `npm run test:e2e`.
- [x] Fresh Vercel preview deployed for user review.
- [x] Phase 2 preview accepted by autonomous/sub-agent review per user instruction.

### Phase 2 Manual Review Checklist

Review URL: https://realestatechatbot-zqomfi5he-dhakalasaces-projects.vercel.app

- [x] Preview deployed and inspected via Vercel CLI; Vercel protection noted for human access.
- [ ] Sign in and open `/dashboard/channels`.
- [ ] Create or open a campaign channel link and complete a buyer flow.
- [ ] Confirm the lead inbox/detail shows source, channel, transcript, score, and UTM attribution.
- [ ] Create a website widget channel with the test site origin in allowed origins.
- [ ] Copy the widget snippet and confirm launcher color follows the bot brand color.
- [ ] Complete a seller flow through the widget and confirm source attribution is `web_embed`.
- [ ] Create a QR channel, copy/download the SVG, and open the QR target URL.
- [ ] Disable a channel and confirm its public chat entry no longer accepts messages.
- [ ] Confirm source/channel filters isolate the expected leads.
- [x] Manual acceptance gate removed by user; continue using autonomous/sub-agent reviews unless a risky external action needs approval.

Need from user before/during Phase 2:

- [x] Confirm widget position: bottom-right recommended.
- [x] Confirm widget color should inherit bot brand color: recommended yes.
- [x] Confirm QR output format: SVG first recommended.
- [x] Confirm active website widget channels require at least one allowed origin; empty origins now fail closed.

Phase 2 status: complete. Closeout hardening is implemented on AWS, automated checks pass, fresh preview is deployed at https://realestatechatbot-zqomfi5he-dhakalasaces-projects.vercel.app, and the user removed the manual acceptance gate in favor of autonomous/sub-agent review.

## Phase 3: AI Runtime

Goal: add AI conversation while the app still owns state, writes, validation, and safety.

- [x] Add Vercel AI SDK / OpenAI integration.
- [x] Define structured output schema.
- [x] Define deterministic tool contracts: app owns state, validation, scoring, persistence, workspace/bot/channel IDs, and lead fields; AI can only return a bounded reply and safety metadata.
- [x] Implement app-validated AI path with no AI-owned database writes or user-controlled tools.
- [x] Add `bot.ai_enabled` flag and dashboard toggle.
- [x] Add AI safety prompt.
- [x] Add no-invention property rule.
- [x] Add legal/tax/mortgage advice safe response.
- [x] Add fair-housing-sensitive response behavior.
- [x] Store AI metadata, safety flags, latency, and token usage where available in bot message `content_json`.
- [x] Keep deterministic fallback working for disabled AI, missing key, test mode, provider error, invalid output, and safety flags.
- [x] Add eval/unit fixtures for core scenarios: valid AI reply, disabled/missing key, provider error, safety freeze, prompt redaction, plain bounded reply.
- [x] Add browser coverage for AI-enabled hosted chat in deterministic test mode.
- [x] Automated checks pass.
- [x] Autonomous/sub-agent review completed; manual acceptance gate removed by user instruction.

Phase 3 verification evidence on AWS, 2026-06-16:

- [x] Supabase migration `202606160001_phase3_ai_runtime.sql` pushed to project `dwvkmxtumugvgytmlbsk`.
- [x] `npm run lint`.
- [x] `npm run typecheck`.
- [x] `npm run test` (5 files, 21 tests).
- [x] `npm run build`.
- [x] `npm run test:bundle-secrets`.
- [x] `npm run test:e2e` (5 Chromium tests).
- [x] Fresh Vercel preview deployed and inspected: https://realestatechatbot-9lw7zff2r-dhakalasaces-projects.vercel.app.
- [x] Vercel authenticated curl verified `/` and `/c/sarah-patel`; logs after smoke requests showed only 200s.

Phase 3 status: complete by autonomous/sub-agent review. Next phase is Phase 4: Properties and Knowledge Base.

## Phase 4: Properties and Knowledge Base

Goal: let bots recommend agent-provided properties and answer from controlled knowledge.

- [x] `properties` table and RLS.
- [x] Property add/edit UI.
- [x] Property image/listing URL fields implemented; Supabase Storage uploads are deferred until file ingestion is needed.
- [x] `knowledge_documents` table and RLS.
- [x] Manual FAQ/document UI.
- [x] Basic `search_properties` retrieval in the server chat path.
- [x] Basic `search_knowledge` retrieval in the server chat path.
- [x] Property cards in chat.
- [x] Bot refuses to invent unavailable property facts when controlled records do not match.
- [x] AI replies are grounded with controlled property/knowledge context and still fall back deterministically.
- [x] Dashboard navigation exposes Properties and Knowledge pages.
- [x] Anonymous and cross-tenant Supabase reads are denied by RLS tests.
- [x] Archived/inactive properties are not returned to public chat retrieval.
- [x] Automated checks pass.
- [x] Autonomous/sub-agent review completed; manual acceptance gate removed by user instruction.

Phase 4 verification evidence on AWS, 2026-06-16:

- [x] Supabase migration `202606160002_phase4_properties_knowledge.sql` pushed to project `dwvkmxtumugvgytmlbsk`.
- [x] `npm run lint`.
- [x] `npm run typecheck`.
- [x] `npm run test` (6 files, 25 tests).
- [x] `npm run build`.
- [x] `npm run test:bundle-secrets`.
- [x] `npm run test:e2e` (6 Chromium tests).
- [x] Phase 4 browser/e2e coverage verifies property creation, knowledge creation, controlled property cards, no-invention fallback, archived-property exclusion, anonymous denial, and cross-tenant denial.
- [x] Fresh Vercel preview deployed and inspected: https://realestatechatbot-mw0otco93-dhakalasaces-projects.vercel.app.
- [x] Vercel authenticated curl verified `/` and `/c/sarah-patel`; recent logs showed only 200 responses.

Phase 4 status: complete by autonomous/sub-agent review. Fresh preview deployed, inspected, and smoke-verified at https://realestatechatbot-mw0otco93-dhakalasaces-projects.vercel.app.

## Phase 5: Appointment Requests and Notifications

Goal: turn qualified conversations into appointment, showing, or valuation requests.

- [x] `appointments` table and RLS.
- [x] `notification_events` outbox table and RLS.
- [x] Buyer consultation request flow.
- [x] Seller valuation request flow.
- [x] Showing request flow.
- [x] Missing appointment time triggers a follow-up question.
- [x] Calendar URL support from agent profile fallback and bot override.
- [x] Appointment dashboard with filters, linked lead, calendar, notification status, status update, and agent notes.
- [x] Lead detail shows appointment requests tied to the transcript.
- [x] Resend-ready email notification helper with mocked tests.
- [x] Notification failure or missing credentials does not block lead or appointment creation; status is recorded as sent, failed, or skipped.
- [x] Public chat writes message, lead, appointment, and notification outbox through transactional server-side RPC.
- [x] Anonymous and cross-tenant Supabase reads are denied by RLS tests.
- [x] Tests mock/disable email sending.
- [x] Automated checks pass.
- [x] Autonomous/browser review covers appointment request and notification flow.

Phase 5 verification evidence on AWS, 2026-06-16:

- [x] Supabase migration `202606160003_phase5_appointments.sql` dry-run passed and was pushed to project `dwvkmxtumugvgytmlbsk`.
- [x] `npm run lint`.
- [x] `npm run typecheck`.
- [x] `npm run test` (8 files, 38 tests).
- [x] `npm run build`.
- [x] `npm run test:bundle-secrets`.
- [x] `npm run test:e2e` (7 Chromium tests).
- [x] Phase 5 browser/e2e coverage verifies buyer consultation, seller valuation, showing request, calendar URL, skipped notification logging, appointment dashboard, lead detail panel, status update, anonymous denial, and cross-tenant denial.
- [x] Fresh Vercel preview deployed and inspected: https://realestatechatbot-auanq4p2b-dhakalasaces-projects.vercel.app.
- [x] Vercel authenticated curl verified `/` and `/c/sarah-patel`; recent logs showed only 200 responses.

Need from user before real email delivery:

- [ ] Resend API key or preferred email provider.
- [ ] Sender domain/from-address decision and DNS setup if using Resend.

Phase 5 status: complete by autonomous/sub-agent review. Fresh preview deployed, inspected, and smoke-verified at https://realestatechatbot-auanq4p2b-dhakalasaces-projects.vercel.app.

## Phase 6: Teams, Brokerages, and Agencies

Goal: make the app usable beyond solo agents.

- [x] Workspace settings.
- [x] Member invitations.
- [x] Roles: owner, admin, agent, viewer.
- [x] Multiple agent profiles.
- [x] Bot assigned to agent/team profile.
- [x] Basic lead routing.
- [x] Team inbox.
- [x] Permission tests.
- [x] Audit events for membership changes.
- [x] Automated checks pass.
- [x] Autonomous/sub-agent review covers owner/admin/agent/viewer behavior.

Phase 6 verification evidence on AWS, 2026-06-16:

- [x] Supabase migrations `202606160004_phase6_teams.sql`, `202606160005_phase6_routing_profiles.sql`, `202606160006_phase6_membership_hardening.sql`, and `202606160007_phase6_owner_and_appointment_routing.sql` were pushed to project `dwvkmxtumugvgytmlbsk`.
- [x] `npm run lint`.
- [x] `npm run typecheck`.
- [x] `npm run test` (8 files, 38 tests).
- [x] `npm run build`.
- [x] `npm run test:bundle-secrets`.
- [x] `npm run test:e2e` (8 Chromium tests).
- [x] Phase 6 browser/e2e coverage verifies team profile creation, bot routing, lead reassignment, appointment recipient/calendar routing after reassignment, clearing bot assignment, admin owner-boundary UI, viewer invite acceptance, viewer read-only UI, RLS mutation denial, audit spoof denial, anonymous invite/audit denial, and last-owner DB guard.
- [x] Fresh Vercel preview deployed and inspected: https://realestatechatbot-gzhe5q504-dhakalasaces-projects.vercel.app.
- [x] Vercel authenticated curl verified `/` and `/c/sarah-patel`; recent logs showed only smoke GET requests and no runtime errors.

Phase 6 status: complete by automated, browser, and sub-agent review. Fresh preview deployed, inspected, and smoke-verified at https://realestatechatbot-gzhe5q504-dhakalasaces-projects.vercel.app.

## Phase 7: Email Follow-Up Automation

Goal: add safe email follow-up before SMS/WhatsApp.

- [x] `follow_up_sequences` table.
- [x] `follow_up_messages` table.
- [x] `lead_follow_up_state` table.
- [x] Explicit lead email consent tracking separate from lead capture consent.
- [x] Consent attestation metadata records dashboard source, acting user, consent text version, and timestamp.
- [x] Unsubscribe link and opt-out tracking with hashed tokens only.
- [x] Public unsubscribe page preserves no-enumeration behavior.
- [x] Scheduled job endpoint at `/api/follow-ups/run`.
- [x] Scheduler requires `Authorization: Bearer CRON_SECRET` and returns 503 if `CRON_SECRET` is missing.
- [x] Vercel cron configured in `vercel.json` for daily production invocation.
- [x] Default buyer no-booking follow-up.
- [x] Default seller valuation follow-up.
- [x] Default showing request follow-up.
- [x] Dashboard controls at `/dashboard/follow-ups` for sequence status and message templates.
- [x] Lead detail controls for consent attestation and suppression.
- [x] Sent/failed/skipped/pending-consent logs and workflow state visibility.
- [x] Missing explicit consent becomes `pending_consent`, not a generic paused state.
- [x] Email delivery is disabled unless `FOLLOW_UP_EMAIL_ENABLED=true` plus Resend provider env vars are configured.
- [x] Scheduler fails closed before email send if unsubscribe token persistence fails.
- [x] Scheduler does not mark delivery complete/skipped/failed if notification event logging fails; state becomes failed instead.
- [x] New migrations pushed: `202606160008_phase7_email_followups.sql` and `202606160009_phase7_followup_hardening.sql`.
- [x] Unit tests cover follow-up helpers, trigger matching, token hashing, template rendering, and disabled delivery behavior.
- [x] Playwright covers follow-up dashboard controls, secured scheduler auth, pending consent, consent attestation, disabled-delivery logging, unsubscribe, anon read denial, outsider read denial, and outsider mutation denial.
- [x] Autonomous security/product review completed; high/medium findings were fixed before deploy.

Phase 7 verification evidence on AWS, 2026-06-16:

- [x] Supabase migrations pushed to project `dwvkmxtumugvgytmlbsk`.
- [x] `npm run lint`.
- [x] `npm run typecheck`.
- [x] `npm run test` (9 files, 45 tests).
- [x] `npm run build`.
- [x] `npm run test:bundle-secrets`.
- [x] `npm run test:e2e` (9 Chromium tests).
- [x] Sub-agent security review findings fixed: unsubscribe token persistence is checked before send, notification event insert failure is no longer fail-open, consent attestation metadata is recorded.
- [x] Sub-agent product/test review findings fixed: `pending_consent` state, clearer delivery environment messaging, visible consent evidence, unsubscribe confirmation copy, dashboard controls/RLS e2e coverage, truthful docs/checklist.
- [x] Fresh Vercel preview deployed and inspected: https://realestatechatbot-rmwjw3ifn-dhakalasaces-projects.vercel.app.
- [x] Preview smoke verified via Vercel curl for `/` and `/c/sarah-patel`; recent Vercel logs showed no runtime errors.

Need from user before real email delivery:

- [ ] Resend API key or preferred email provider.
- [ ] Sender domain/from-address decision and DNS setup if using Resend.
- [ ] Production `CRON_SECRET` before promoting a production deployment with the cron enabled.
- [ ] Final legal/compliance wording for email consent and unsubscribe before public launch.

Phase 7 status: complete by automated, browser, and sub-agent review. Fresh preview deployed, inspected, and smoke-verified at https://realestatechatbot-rmwjw3ifn-dhakalasaces-projects.vercel.app.

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

Clean generated artifacts and start Phase 8 planning. Do not start Phase 8 implementation until its plan is reviewed against the source-of-truth docs.

Current engineering status:

```text
Phases 0-6 are complete. Phase 7 email follow-up automation is complete with preview https://realestatechatbot-rmwjw3ifn-dhakalasaces-projects.vercel.app; Phase 8 planning is next.
```

Human gate:

```text
Manual acceptance gates are removed by user instruction. Continue phase-by-phase with automated, browser, and sub-agent review; stop only for credentials, money, production promotion, secret rotation, destructive or irreversible external actions.
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
