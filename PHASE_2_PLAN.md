# Phase 2 Plan: Widget, QR, And Channel Tracking

## Summary

Phase 2 turns the working hosted bot into a multi-surface lead capture system.

The goal is:

```text
one bot can be shared through hosted links, website widgets, QR codes, social/campaign links -> every conversation and lead records its source
```

This follows the product direction in the raw verdict: RealEstateChatbot.ai is not just a hosted chatbot. It is a hosted link, website widget, QR/social chatbot system for real estate lead capture.

Implementation status: complete by autonomous/sub-agent review. Built, closeout-hardened, acceptance-cleaned, deployed to a fresh Vercel preview from AWS, and verified with automated checks. User removed manual acceptance gates moving forward.

## Docs To Follow

- Next.js Route Handlers: https://nextjs.org/docs/app/api-reference/file-conventions/route
- Next.js Script behavior: https://nextjs.org/docs/app/api-reference/components/script
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase migrations: https://supabase.com/docs/guides/deployment/database-migrations
- Vercel cache headers/CDN behavior: https://vercel.com/docs/headers/cache-control-headers

## Scope

Build channel attribution and sharing surfaces only.

In scope:

- Channel model improvements for hosted, embed, QR, social, and campaign links.
- Channel manager in the dashboard.
- Source tracking on conversations and leads.
- Public hosted URLs with channel keys.
- Website widget loader script.
- Compact embedded chatbot page.
- QR code generation/download for QR channels.
- Lead inbox/detail source display and filters.
- Automated tests and browser verification.

Out of scope:

- AI runtime.
- Open house-specific conversation flow.
- Appointment booking.
- Email/SMS follow-up.
- Custom domains.
- MLS/IDX.
- Billing.

## Data Model

Use the existing `bot_channels` table as the source of truth.

Add or formalize:

- channel type values:
  - `hosted_link`
  - `web_embed`
  - `qr_code`
  - `social_link`
  - `campaign`
- channel label/name.
- public channel key for shareable URLs.
- optional allowed origins for widget channels.
- source tracking fields in channel settings:
  - `source`
  - `medium`
  - `campaign`
  - `content`
- per-channel active/disabled status.

Add lead/conversation attribution:

- `conversations.bot_channel_id` is already present.
- add normalized source fields to `conversations` if needed for reporting.
- add `bot_channel_id` and source summary fields to `leads` for fast dashboard display.
- preserve raw `source_url`, `referrer`, and UTM data in metadata.

Security:

- RLS stays enabled on all workspace-owned tables.
- Only authenticated workspace members can create/update/read channels.
- Anonymous visitors never write directly to Supabase.
- Public chat writes still go through `POST /api/chat`.

## Public URL Strategy

Use channel keys instead of internal IDs.

Hosted and campaign links:

```text
/c/[bot-slug]?ch=[channel-public-key]
```

If `ch` is absent, use the bot's default active hosted channel.

Widget embed:

```html
<script async src="https://APP_URL/widget.js?channel=CHANNEL_PUBLIC_KEY"></script>
```

The script injects a small launcher and iframe. The iframe loads:

```text
/embed/[channel-public-key]?parentUrl=...
```

This keeps the customer site isolated from our React app and avoids cross-origin API calls from the parent page. The iframe calls our own `/api/chat` route on the app origin.

QR links:

```text
/c/[bot-slug]?ch=[qr-channel-public-key]
```

QR code generation should encode the channel URL, not a private database ID.

## Dashboard UX

Add a channel manager for the active bot.

Recommended route:

```text
/dashboard/channels
```

Views:

- Channel list grouped by type.
- Create channel form.
- Edit channel label/status/settings.
- Copy hosted/social/campaign link.
- Copy website widget snippet.
- View/download QR code.
- Source counts summary.

Lead inbox changes:

- show source label/type on each lead row.
- filter by channel/source.
- lead detail shows channel, source URL, referrer, and UTM fields.

Dashboard home changes:

- keep active hosted bot link.
- add a concise channel/source summary.
- link to channel manager.

## API And Route Changes

Extend `POST /api/chat` input:

```ts
{
  slug?: string
  channelKey?: string
  widgetToken?: string
  sessionId?: string
  message: string
  sourceUrl?: string
  referrer?: string
  utm?: {
    source?: string
    medium?: string
    campaign?: string
    content?: string
    term?: string
  }
}
```

Validation rules:

- require either `slug` or `channelKey`.
- message max stays 2000 characters.
- source/referrer/UTM fields are length-limited and sanitized.
- channel must be active.
- channel must belong to the resolved bot.
- disabled/draft bot or disabled channel returns generic unavailable error.
- active widget channels require at least one allowed origin, and widget origin is checked before /widget.js, /embed/[channelKey], or /api/chat accepts messages.
- widget channels require a server-issued signed token from `/widget.js` before `/embed/[channelKey]` or `/api/chat` accepts messages.
- chat-turn persistence fails closed through the `record_chat_turn` RPC; visitor message, bot message, conversation state, and lead upsert succeed or fail together.
- lead/channel workspace integrity is enforced by database trigger.
- hosted links parse and persist UTM params from `/c/[slug]` query strings.

Public routes:

- `GET /widget.js`
  - validates channel key format.
  - returns JavaScript with `Content-Type: application/javascript`.
  - uses safe cache headers.
  - does not expose secrets or private bot config.
- `GET /embed/[channelKey]`
  - renders compact chat UI for iframe.
  - no dashboard chrome.
  - noindex.
- `GET /api/channels/[channelId]/qr.svg` or dashboard server action
  - member-only QR generation.
  - only active qr_code channels for active bots return SVG.
  - output encodes public channel URL.

## Implementation Slices

### Slice 1: Channel Data And Attribution

- migration for channel type/status/source fields.
- update onboarding RPC to create a default hosted channel with label.
- update chat API to resolve `channelKey`.
- persist source/channel on conversations and leads.
- show source in lead inbox/detail.
- tests for channel attribution and disabled-channel rejection.

Done when:

- `/c/sarah-patel?ch=...` creates a lead tied to that channel.
- dashboard lead row/detail shows source.
- disabled channel does not accept chat.

### Slice 2: Dashboard Channel Manager

- add `/dashboard/channels`.
- list default hosted channel.
- create campaign/social/QR/widget channels.
- edit label/status/settings.
- copy links/snippets.
- add source filters in lead inbox.

Done when:

- agent can create each channel type.
- generated links use public channel keys.
- duplicate/invalid labels or keys are handled.

### Slice 3: Website Widget

- add `/widget.js`.
- add `/embed/[channelKey]`.
- iframe-based floating widget launcher.
- pass parent URL/referrer/UTM safely.
- optional origin restriction for widget channels.

Done when:

- `/widget.js` issues signed tokens only to allowed origins.
- browser e2e verifies launcher/iframe rendering from an allowed local origin; preview manual review verifies a true external site origin.
- visitor completes buyer/seller flow inside widget.
- lead source shows `web_embed`.
- wrong/disabled channel fails safely.

### Slice 4: QR And Reporting Polish

- QR generation for QR channels.
- download/copy QR channel URL.
- channel/source counts.
- Playwright coverage for hosted channel, widget, QR/campaign attribution, source filters.

Done when:

- QR URL opens hosted bot.
- leads from QR/campaign/widget are distinguishable in dashboard.
- automated checks pass.

## Test Plan

Automated:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run build`

Unit tests:

- channel key validation.
- source/UTM sanitization.
- origin matching for widget channels.
- channel URL generation.

Route/action tests:

- create/update channel.
- disable channel.
- chat with channel key.
- reject mismatched bot/channel.
- reject disabled channel.

Playwright:

- login/onboarding still works.
- create campaign channel.
- open `/c/[slug]?ch=[key]`, complete buyer flow, verify source in lead inbox/detail.
- create widget channel, verify denied origin/missing token failures, render widget from an allowed local origin, complete seller flow, verify source.
- create QR channel and verify QR target URL.
- filter lead inbox by source/channel.

Security acceptance:

- user A cannot read/update user B channels.
- anonymous visitors cannot read private channel settings.
- public channel key cannot expose workspace IDs or secrets.
- signed widget tokens cannot be omitted or reused from the wrong origin.
- swapping `channelKey` across bots fails.
- disabled channel and draft bot fail.
- non-QR or disabled QR channels do not return QR SVG.
- lead rows cannot be reassigned to another workspace/bot channel.
- browser bundle contains no service role, OpenAI, or database secrets.

Manual review:

1. Create campaign link.
2. Open campaign link in incognito.
3. Complete buyer flow.
4. Confirm lead source in dashboard.
5. Create widget channel.
6. Paste snippet into a page whose origin is listed in the widget channel allowed origins.
7. Complete seller flow through widget.
8. Confirm lead source and transcript.
9. Create QR channel.
10. Open QR target URL and complete short smoke flow.
11. Disable a channel and confirm it no longer accepts messages.

## Human Decisions Needed

Before or during build:

- Confirm initial widget position: bottom-right recommended.
- Confirm widget color should inherit bot brand color: yes recommended.
- Confirm QR output format: SVG first, PNG later if needed.
- Active website widget channels require at least one allowed origin; empty widget allowed origins fail closed.

## Risks

- Widget script can easily become brittle if it tries to run the whole React app on customer sites. Use iframe isolation.
- Channel source tracking can drift if data is only stored in JSON metadata. Store normalized source fields needed for dashboard display.
- Public keys must not become authorization for private dashboard data. They only identify active public channels for chat entry.
- Preview deployments may remain Vercel-protected; production or protection-bypass is needed for true external widget testing.

## Recommended Build Order

1. Migration and attribution plumbing.
2. Chat API channel resolution.
3. Lead inbox/detail source display.
4. Channel manager dashboard.
5. Widget loader and embed page.
6. QR generation.
7. Playwright e2e and manual review.
