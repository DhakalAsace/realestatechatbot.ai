import type { Metadata } from "next";
import { absoluteUrl, siteConfig } from "@/lib/marketing";

export type LegalPage = {
  path: string;
  title: string;
  description: string;
  updated: string;
  sections: Array<{ heading: string; body: string[] }>;
};

export const legalPages: LegalPage[] = [
  {
    path: "/privacy",
    title: "Privacy Policy",
    description: "How RealEstateChatbot.ai handles lead, workspace, and product usage data for real estate teams.",
    updated: "June 16, 2026",
    sections: [
      { heading: "What we collect", body: ["The product stores workspace account data, bot configuration, lead contact details, chat transcripts, source attribution, appointment requests, follow-up preferences, usage events, and billing entitlement records needed to run the service."] },
      { heading: "How data is used", body: ["Data is used to operate the chatbot, qualify and route real estate leads, show transcripts and scores to authorized workspace members, process appointment and follow-up workflows, enforce plan limits, and troubleshoot the service."] },
      { heading: "Access controls", body: ["Workspace data is protected by Supabase Row Level Security and server-side authorization. Public chatbot visitors cannot read dashboard data, leads, transcripts, billing records, or private bot configuration."] },
      { heading: "Third-party processors", body: ["The application is hosted on Vercel, stores data in Supabase, can use OpenAI for AI-assisted replies when enabled, can use Stripe for billing when configured, and can use an email provider for follow-up delivery when enabled."] },
      { heading: "Launch note", body: ["Before public production launch, finalize the support contact, data retention policy, cookie/analytics posture, and any jurisdiction-specific privacy language with counsel."] },
    ],
  },
  {
    path: "/terms",
    title: "Terms of Service",
    description: "Product terms for using RealEstateChatbot.ai as a real estate lead conversion assistant.",
    updated: "June 16, 2026",
    sections: [
      { heading: "Service scope", body: ["RealEstateChatbot.ai helps agents, teams, and brokerages capture and qualify real estate leads from hosted links, widgets, QR codes, and campaigns. It is not an MLS, IDX feed, CRM of record, legal service, tax service, mortgage advisor, or financial advisor."] },
      { heading: "Customer responsibilities", body: ["Customers are responsible for the accuracy of their own brokerage, listing, property, follow-up, consent, and compliance information. Customers must review transcripts and verify facts before relying on or forwarding them."] },
      { heading: "AI-assisted output", body: ["AI-assisted replies may be incomplete or incorrect. The app keeps workflow state, scoring, authorization, and persistence under application control, but users must verify property facts and professional advice independently."] },
      { heading: "Availability and changes", body: ["The product is still in pre-launch buildout. Features, limits, billing setup, and policies may change before production launch."] },
      { heading: "Launch note", body: ["Before public production launch, finalize governing law, warranty, liability, support, cancellation, refund, and dispute terms with counsel."] },
    ],
  },
  {
    path: "/acceptable-use",
    title: "Acceptable Use Policy",
    description: "Rules for safe and compliant use of RealEstateChatbot.ai.",
    updated: "June 16, 2026",
    sections: [
      { heading: "Allowed use", body: ["Use the service for legitimate real estate lead intake, follow-up workflows, appointment requests, and agent or brokerage operations."] },
      { heading: "Disallowed use", body: ["Do not use the service for spam, harassment, scraping, credential collection, malware, misleading listings, impersonation, illegal discrimination, protected-class steering, or attempts to extract prompts, secrets, tokens, or private workspace data."] },
      { heading: "Professional boundaries", body: ["Do not present AI output as legal, tax, mortgage, financial, appraisal, inspection, or guaranteed property advice. Do not ask the assistant to invent MLS, listing, pricing, availability, or neighborhood facts."] },
      { heading: "Enforcement", body: ["The service may block abusive public chat payloads, rate-limit traffic, suspend unsafe bots, and preserve audit records for workspace and security review."] },
    ],
  },
  {
    path: "/ai-disclaimer",
    title: "AI Disclaimer",
    description: "Important limits for AI-assisted replies in RealEstateChatbot.ai.",
    updated: "June 16, 2026",
    sections: [
      { heading: "AI is assistive", body: ["AI-assisted replies can make the conversation feel more natural, but the app owns the lead workflow state, validation, scoring, authorization, persistence, and safety fallbacks."] },
      { heading: "No professional advice", body: ["The assistant must not provide legal, tax, mortgage, financial, appraisal, inspection, or fair-housing steering advice. It should collect lead context and route the visitor to a qualified professional."] },
      { heading: "No invented property facts", body: ["The assistant should only reference controlled property or knowledge records available in the workspace. Listing, MLS, price, availability, neighborhood, and property facts must be verified by the agent or brokerage."] },
      { heading: "Human review", body: ["Agents and teams should review transcripts, lead scores, appointments, and follow-up preferences before acting on them."] },
    ],
  },
];

export function requireLegalPage(path: string) {
  const page = legalPages.find((item) => item.path === path);
  if (!page) throw new Error("Missing legal page config for " + path);
  return page;
}

export function legalMetadata(page: LegalPage): Metadata {
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: absoluteUrl(page.path) },
    openGraph: { type: "website", url: absoluteUrl(page.path), title: page.title, description: page.description, siteName: siteConfig.name },
    twitter: { card: "summary", title: page.title, description: page.description },
  };
}
