# Launch Security Checklist

Phase 10 launch-hardening checklist for RealEstateChatbot.ai.

## Automated Gates

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:bundle-secrets`
- `npm run test:e2e`

## Public Surface

- Public chat validates payload shape, slug/channel status, widget tokens, active bots, source origin, and session ownership.
- Public chat has durable database-backed rate limits plus in-process burst protection.
- Public chat rejects spam, prompt-extraction, unsafe markup, control characters, link floods, and oversized payloads.
- Public hosted bot and embed pages remain `noindex`.
- Public legal/disclaimer pages are present: Privacy, Terms, Acceptable Use, and AI Disclaimer.

## Data And Authorization

- Workspace-owned data must remain protected by RLS.
- Server-side actions and route handlers must re-check workspace membership and role.
- Service-role/Supabase secret/OpenAI/Stripe keys must never be exposed to the browser bundle.
- Lead export must use the signed-in user's workspace membership and RLS, not anonymous access.
- Audit events must be readable only by workspace members and reviewed from the admin dashboard.

## AI Safety

- AI must not own workflow state, scoring, database writes, workspace IDs, bot IDs, lead fields, or authorization.
- AI must not invent property, MLS, listing, price, availability, neighborhood, or market facts.
- AI must not provide legal, tax, mortgage, financial, appraisal, inspection, or fair-housing steering advice.
- AI eval tests must cover safe fallback, contact redaction, no-invention, and advice-boundary prompts.

## External Gates Before Public Production Launch

- Rotate OpenAI key.
- Finalize domain attachment.
- Configure Stripe test/production credentials, price IDs, webhook secret, trial policy, and billing copy.
- Configure email provider, sender domain/from-address, DNS, consent text, and unsubscribe wording.
- Decide Vercel analytics/speed insights/log-drain/external monitoring setup.
- Revisit Supabase Auth email confirmation/custom SMTP.
- Review npm audit findings and dependency update posture.
- Promote production only after explicit user approval.
