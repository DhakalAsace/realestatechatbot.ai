# AGENTS.md

## Product

RealEstateChatbot.ai is a SaaS for real estate agents, teams, brokerages, and agencies.

It lets customers create AI chatbots that capture, qualify, route, follow up with, and book buyer/seller leads from hosted links, website widgets, QR codes, and social traffic.

## Operating Rule

Work for this project happens on the AWS dev box under `/home/ec2-user/realestatechatbot.ai`.

Do not use or modify other projects' Vercel links, Supabase MCP servers, Git remotes, or environment variables.

## Build Principle

Build vertical slices. Do not build disconnected backend, UI, AI, or SEO layers.

Every feature should include:

- acceptance criteria
- DB/schema changes if needed
- UI states
- server/API logic
- validation and authorization
- tests where risk justifies them
- manual test notes in `PROJECT_CONTEXT.md`

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, RLS, Storage
- OpenAI / Vercel AI SDK
- Vercel
- Vitest
- Playwright

## Commands

- dev: `npm run dev`
- build: `npm run build`
- lint: `npm run lint`
- test: add when the test runner is installed
- test:e2e: add when Playwright is installed

## Product Constraints

- Do not build a generic chatbot builder.
- Do not build a CRM.
- Do not build MLS/IDX in v1.
- Do not create duplicate SEO pages for semantic keyword variants.
- Homepage owns the main money keyword cluster.
- Supporting SEO pages must target distinct search intent.
- Customer bot pages are noindex by default.
- AI must not invent property facts.
- AI must not provide legal, tax, mortgage, or financial advice.
- App controls state, authorization, scoring, validation, tools, and DB writes.
- LLM writes natural responses and returns structured output.
- Public endpoints must be rate-limited and validated.
- Every workspace-owned record must enforce authorization.

## Done Means

- Build passes.
- Lint passes.
- Relevant tests pass.
- Main user flow works manually.
- Loading, empty, error, and success states exist.
- Mobile layout works.
- No console errors.
- No unauthorized cross-workspace data access.
- No service-role key is exposed to the browser.
