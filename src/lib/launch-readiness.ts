export type LaunchReadinessStatus = "ready" | "review" | "external_gate";

export type LaunchReadinessItem = {
  label: string;
  status: LaunchReadinessStatus;
  detail: string;
};

export type LaunchReadinessSection = {
  title: string;
  items: LaunchReadinessItem[];
};

export const launchReadinessSections: LaunchReadinessSection[] = [
  {
    title: "Security",
    items: [
      { label: "Workspace RLS", status: "ready", detail: "Workspace-owned records use RLS and server-side authorization from prior phases." },
      { label: "Public chat rate limits", status: "ready", detail: "Phase 10 adds durable database-backed buckets plus a lightweight in-process guard." },
      { label: "Spam and prompt-extraction checks", status: "ready", detail: "Public chat rejects link floods, unsafe markup, repeated characters, spam phrases, and prompt/secret extraction attempts." },
      { label: "Browser secret scan", status: "ready", detail: "The bundle-secret scanner remains part of the release gate." },
      { label: "OpenAI key rotation", status: "external_gate", detail: "Rotate before public production launch. Codex must not rotate secrets without explicit approval." },
    ],
  },
  {
    title: "Observability",
    items: [
      { label: "Structured runtime logs", status: "ready", detail: "Public chat emits JSON logs with request id, route, status, duration, and sanitized error context." },
      { label: "Vercel error-log scan", status: "ready", detail: "Each preview closeout uses Vercel logs/inspect for runtime error review." },
      { label: "Log drains or analytics", status: "review", detail: "Account-level drains, Web Analytics, Speed Insights, or external monitoring require dashboard setup and production preference." },
    ],
  },
  {
    title: "Launch gates",
    items: [
      { label: "Stripe payment activation", status: "external_gate", detail: "Still needs test keys, price IDs, webhook endpoint, pricing, trial policy, and production approval." },
      { label: "Email delivery activation", status: "external_gate", detail: "Still needs sender domain/from-address/provider credentials and final consent copy." },
      { label: "Production promotion", status: "external_gate", detail: "Preview deploys are allowed; production promotion requires explicit user approval." },
      { label: "Primary domain", status: "external_gate", detail: "realestatechatbot.ai domain attachment remains a user/account-level decision." },
    ],
  },
];

export function statusLabel(status: LaunchReadinessStatus) {
  if (status === "ready") return "Ready";
  if (status === "review") return "Review";
  return "External gate";
}
