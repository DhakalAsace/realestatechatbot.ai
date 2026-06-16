import type { Metadata } from "next";

export const siteConfig = {
  name: "RealEstateChatbot.ai",
  baseUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://realestatechatbot-ai.vercel.app",
  description: "AI real estate chatbot for agents, teams, and brokerages that captures, qualifies, routes, books, and follows up with buyer and seller leads.",
  shortPromise: "Turn real estate traffic into qualified appointments 24/7.",
  signupPath: "/login",
  sampleBotPath: "/c/sarah-patel",
};

export type MarketingFAQ = { question: string; answer: string };
export type MarketingSection = { title: string; body: string; bullets: string[] };
export type MarketingPage = {
  path: string;
  title: string;
  metaTitle: string;
  description: string;
  intent: string;
  eyebrow: string;
  heroTitle: string;
  heroBody: string;
  primaryCta: string;
  secondaryCta: string;
  sections: MarketingSection[];
  proof: string[];
  faq: MarketingFAQ[];
  sitemapPriority: number;
};

export const requiredPhase9Paths = [
  "/tools/real-estate-chatbot-template-generator",
  "/examples/real-estate-chatbot-examples",
  "/guides/how-to-build-a-real-estate-chatbot",
  "/guides/real-estate-lead-capture",
  "/use-cases/home-valuation-chatbot",
  "/use-cases/open-house-chatbot",
  "/use-cases/property-recommendation-chatbot",
  "/best-real-estate-chatbots",
] as const;

const defaultFaq: MarketingFAQ[] = [
  { question: "Is this a generic chatbot builder?", answer: "No. RealEstateChatbot.ai is focused on real estate lead capture, source attribution, appointments, follow-up, routing, and safe AI behavior for agents and teams." },
  { question: "Can the AI invent property facts or advice?", answer: "No. The app is designed so property-specific answers come from controlled property and knowledge records, and the assistant avoids legal, tax, mortgage, and financial advice." },
];

export const homepage: MarketingPage = {
  path: "/",
  title: "AI real estate chatbot for qualified appointments",
  metaTitle: "RealEstateChatbot.ai | AI Real Estate Chatbot for Lead Capture",
  description: siteConfig.description,
  intent: "main-money-page",
  eyebrow: "AI real estate lead assistant",
  heroTitle: "Turn real estate traffic into qualified appointments 24/7.",
  heroBody: "RealEstateChatbot.ai gives agents, teams, and brokerages hosted links, website widgets, QR codes, routing, appointments, follow-ups, and billing-aware limits in one real-estate-specific lead conversion system.",
  primaryCta: "Open dashboard",
  secondaryCta: "Try sample bot",
  sections: [
    { title: "Real-estate-specific qualification", body: "Every workflow starts from buyer, seller, valuation, showing, open-house, and agent follow-up patterns instead of generic chat prompts.", bullets: ["Buyer and seller flows", "Lead score and transcript", "Appointment requests", "Consent-aware follow-up"] },
    { title: "One assistant across every channel", body: "Publish the same bot through hosted links, website embeds, QR codes, social links, and campaigns while preserving source attribution.", bullets: ["Hosted /c/[slug] links", "Signed website widget", "QR and campaign links", "UTM reporting"] },
    { title: "Controls for teams and brokerages", body: "Owners, admins, agents, and viewers get the right access. Leads can route to agent or team profiles, and billing limits protect cost-bearing actions.", bullets: ["Workspace roles", "Team routing", "RLS-protected data", "Plan and usage meters"] },
  ],
  proof: ["Hosted bot", "Website widget", "QR campaigns", "Lead inbox", "Appointments", "Follow-ups", "Billing limits"],
  faq: [
    { question: "What is RealEstateChatbot.ai?", answer: "It is an AI-assisted real estate lead conversion assistant for agents, teams, brokerages, and agencies. It captures and qualifies buyer and seller leads from hosted links, website widgets, QR codes, and campaigns." },
    { question: "Does it replace a CRM?", answer: "No. It focuses on turning traffic into qualified conversations, appointments, transcripts, routing, and follow-up records that can later connect to a CRM." },
    { question: "Can customer bot pages rank in search?", answer: "No. Customer hosted bot and embed pages are noindex by default so the public SEO surface stays focused on product and education pages." },
  ],
  sitemapPriority: 1,
};

export const marketingPages: MarketingPage[] = [
  {
    path: "/tools/real-estate-chatbot-template-generator",
    title: "Real estate chatbot template generator",
    metaTitle: "Real Estate Chatbot Template Generator",
    description: "Generate buyer, seller, open-house, valuation, and property-recommendation chatbot scripts for real estate lead capture.",
    intent: "interactive-template-tool",
    eyebrow: "Free planning tool",
    heroTitle: "Generate a real estate chatbot script before you launch the bot.",
    heroBody: "Pick a lead goal and get a real-estate-specific chatbot outline with opening copy, qualification questions, routing notes, and follow-up reminders.",
    primaryCta: "Open dashboard",
    secondaryCta: "Try sample bot",
    sections: [
      { title: "Start with the lead outcome", body: "A useful real estate chatbot starts from the conversion you want: buyer consultation, seller valuation, showing request, open-house follow-up, or property recommendation.", bullets: ["Buyer qualification", "Seller valuation", "Showing request", "Open-house lead capture"] },
      { title: "Keep qualification short", body: "The generated scripts focus on contact, intent, area, timeline, budget or property address, and readiness so the lead is actionable.", bullets: ["Name and contact", "Area or address", "Timeline", "Readiness"] },
    ],
    proof: ["Buyer script", "Seller script", "Open-house script", "Follow-up checklist"],
    faq: [
      { question: "Can I use the generated script outside the product?", answer: "Yes. The tool is useful for planning, while the full product adds hosted links, widgets, transcripts, scoring, routing, and follow-up state." },
      { question: "Should a chatbot ask every question at once?", answer: "No. It should ask one concise question at a time and only collect details that help the agent follow up." },
    ],
    sitemapPriority: 0.82,
  },
  {
    path: "/examples/real-estate-chatbot-examples",
    title: "Real estate chatbot examples",
    metaTitle: "Real Estate Chatbot Examples for Buyers and Sellers",
    description: "Review practical real estate chatbot examples for buyer leads, seller valuation requests, open houses, property inquiries, and campaign traffic.",
    intent: "example-gallery",
    eyebrow: "Conversation examples",
    heroTitle: "Examples of real estate chatbots that capture usable lead details.",
    heroBody: "Use these example flows to plan how your assistant should qualify buyer, seller, open-house, and property-specific traffic without feeling generic.",
    primaryCta: "Open dashboard",
    secondaryCta: "Try sample bot",
    sections: [
      { title: "Buyer lead example", body: "The assistant captures contact, preferred area, budget, timeline, property type, and financing readiness.", bullets: ["Intent: buying", "Area and budget", "Move timeline", "Pre-approval status"] },
      { title: "Seller valuation example", body: "The assistant confirms seller intent, property area or address, timeline, valuation interest, and contact details.", bullets: ["Intent: selling", "Address or area", "Valuation interest", "Follow-up preference"] },
      { title: "Open-house example", body: "A QR code can collect visitor details and preserve the event channel in the inbox.", bullets: ["QR source", "Showing request", "Property interest", "Post-event follow-up"] },
    ],
    proof: ["Buyer", "Seller", "Open house", "Property inquiry"],
    faq: defaultFaq,
    sitemapPriority: 0.78,
  },
  {
    path: "/guides/how-to-build-a-real-estate-chatbot",
    title: "How to build a real estate chatbot",
    metaTitle: "How to Build a Real Estate Chatbot That Captures Leads",
    description: "A practical guide to building a real estate chatbot with lead capture, qualification, routing, appointments, follow-up, and safe AI behavior.",
    intent: "how-to-guide",
    eyebrow: "Implementation guide",
    heroTitle: "Build a real estate chatbot around the lead handoff, not the novelty of AI.",
    heroBody: "The fastest path is a vertical product loop: publish a bot, qualify a visitor, save the transcript, route the lead, and follow up with consent.",
    primaryCta: "Open dashboard",
    secondaryCta: "Try sample bot",
    sections: [
      { title: "Define the lead types", body: "Separate buyer, seller, showing, valuation, and open-house flows so each collects only what the agent needs next.", bullets: ["Buyer consultation", "Seller valuation", "Showing request", "Open-house follow-up"] },
      { title: "Choose share surfaces", body: "Use hosted links for social traffic, a website widget for site visitors, QR codes for offline events, and campaign links for attribution.", bullets: ["Hosted links", "Website widget", "QR codes", "Campaign UTM tracking"] },
      { title: "Keep AI bounded", body: "Let AI improve replies, but keep state, validation, scoring, authorization, and database writes in app code.", bullets: ["App-owned state", "Controlled retrieval", "No invented facts", "Advice boundaries"] },
    ],
    proof: ["Architecture", "Channels", "State", "Safety"],
    faq: defaultFaq,
    sitemapPriority: 0.78,
  },
  {
    path: "/guides/real-estate-lead-capture",
    title: "Real estate lead capture guide",
    metaTitle: "Real Estate Lead Capture: Convert Traffic Into Appointments",
    description: "Learn how agents and teams can improve real estate lead capture with chatbots, source attribution, qualification, routing, and follow-up.",
    intent: "lead-capture-guide",
    eyebrow: "Lead capture playbook",
    heroTitle: "Real estate lead capture works when the follow-up handoff is already designed.",
    heroBody: "Traffic is only useful when the agent can see who the visitor is, what they want, where they came from, how urgent they are, and what should happen next.",
    primaryCta: "Open dashboard",
    secondaryCta: "Try sample bot",
    sections: [
      { title: "Capture source first", body: "Campaign, QR, widget, and hosted-link attribution help teams decide which traffic sources create qualified conversations.", bullets: ["UTM source", "Channel label", "Referrer", "Campaign medium"] },
      { title: "Ask useful questions", body: "Budget, area, timeline, property type, address, and readiness make the lead more useful than a plain form.", bullets: ["Intent", "Contact", "Timeline", "Readiness"] },
      { title: "Route with context", body: "Transcripts, scores, assignments, appointments, and follow-up records keep the next step visible.", bullets: ["Transcript", "Score", "Assignment", "Follow-up state"] },
    ],
    proof: ["Attribution", "Qualification", "Routing", "Follow-up"],
    faq: defaultFaq,
    sitemapPriority: 0.78,
  },
  {
    path: "/use-cases/home-valuation-chatbot",
    title: "Home valuation chatbot",
    metaTitle: "Home Valuation Chatbot for Seller Lead Capture",
    description: "Use a home valuation chatbot to capture seller leads, property details, valuation interest, timing, and contact information for agent follow-up.",
    intent: "seller-valuation-use-case",
    eyebrow: "Seller use case",
    heroTitle: "Capture seller valuation leads without promising an instant appraisal.",
    heroBody: "A good home valuation chatbot identifies the property, seller timeline, valuation intent, and follow-up contact while avoiding pricing claims it cannot support.",
    primaryCta: "Open dashboard",
    secondaryCta: "Try sample bot",
    sections: [
      { title: "Collect seller details carefully", body: "Ask for address or area, timeline, property type, valuation interest, and the best contact method.", bullets: ["Address or area", "Selling timeline", "Valuation interest", "Contact preference"] },
      { title: "Avoid fake certainty", body: "The chatbot can connect the seller with an agent for valuation, but should not invent price estimates or market claims.", bullets: ["No invented values", "Agent follow-up", "Transcript saved", "Seller source tracked"] },
    ],
    proof: ["Seller capture", "Valuation intent", "Safe AI", "Follow-up"],
    faq: defaultFaq,
    sitemapPriority: 0.72,
  },
  {
    path: "/use-cases/open-house-chatbot",
    title: "Open house chatbot",
    metaTitle: "Open House Chatbot for QR Code Lead Capture",
    description: "Use an open house chatbot with QR codes to capture visitor details, showing interest, buyer timeline, and follow-up consent after an event.",
    intent: "open-house-use-case",
    eyebrow: "Open-house use case",
    heroTitle: "Turn open-house foot traffic into organized follow-up conversations.",
    heroBody: "A QR-driven open house chatbot can collect visitor details, property interest, showing requests, and timeline while preserving the exact event channel.",
    primaryCta: "Open dashboard",
    secondaryCta: "Try sample bot",
    sections: [
      { title: "Use QR channels", body: "Each open house can have its own QR channel so the dashboard shows which event produced each lead.", bullets: ["QR link", "Event source", "Property interest", "Visitor transcript"] },
      { title: "Capture readiness", body: "Ask whether the visitor wants a showing, is buying soon, has financing, and wants agent follow-up.", bullets: ["Showing request", "Move timeline", "Financing readiness", "Consent-aware follow-up"] },
    ],
    proof: ["QR", "Event", "Showing", "Follow-up"],
    faq: defaultFaq,
    sitemapPriority: 0.72,
  },
  {
    path: "/use-cases/property-recommendation-chatbot",
    title: "Property recommendation chatbot",
    metaTitle: "Property Recommendation Chatbot for Real Estate Leads",
    description: "Help buyers describe location, budget, property type, timeline, and preferences while keeping recommendations grounded in controlled property data.",
    intent: "property-recommendation-use-case",
    eyebrow: "Buyer use case",
    heroTitle: "Recommend next steps from real buyer preferences, not invented listings.",
    heroBody: "A property recommendation chatbot should collect preferences, match against controlled property records when available, and ask the agent to follow up when details are missing.",
    primaryCta: "Open dashboard",
    secondaryCta: "Try sample bot",
    sections: [
      { title: "Collect buyer preferences", body: "Area, budget, property type, timeline, and financing readiness create a useful lead before any recommendation appears.", bullets: ["Area", "Budget", "Property type", "Pre-approval"] },
      { title: "Ground recommendations", body: "The assistant should only reference property details that exist in the workspace property library or knowledge base.", bullets: ["Controlled properties", "Knowledge grounding", "No invented facts", "Agent handoff"] },
    ],
    proof: ["Buyer preferences", "Controlled records", "Safe recommendations", "Agent handoff"],
    faq: defaultFaq,
    sitemapPriority: 0.72,
  },
  {
    path: "/best-real-estate-chatbots",
    title: "Best real estate chatbots",
    metaTitle: "Best Real Estate Chatbots: What Agents Should Compare",
    description: "Compare real estate chatbot features that matter: lead capture, widgets, QR codes, attribution, AI safety, routing, follow-up, and billing limits.",
    intent: "comparison-framework",
    eyebrow: "Comparison guide",
    heroTitle: "The best real estate chatbot creates a clean agent handoff.",
    heroBody: "Evaluate real estate chatbots by lead quality, channel attribution, AI safety, team routing, follow-up workflows, and operational controls.",
    primaryCta: "Open dashboard",
    secondaryCta: "Try sample bot",
    sections: [
      { title: "Compare outcomes", body: "A chatbot should produce a qualified lead with transcript, score, source, assignment, and next step.", bullets: ["Lead score", "Transcript", "Source attribution", "Appointment request"] },
      { title: "Check channel coverage", body: "Look for hosted links, website widget, QR codes, social links, campaign links, and source filters.", bullets: ["Hosted link", "Widget", "QR", "Campaign attribution"] },
      { title: "Check safety", body: "Real estate chatbots need tenant isolation, no service-role secrets in the browser, no invented property facts, and advice boundaries.", bullets: ["RLS", "Server-side writes", "Controlled knowledge", "Advice boundaries"] },
    ],
    proof: ["Lead outcome", "Channels", "Safety", "Operations"],
    faq: defaultFaq,
    sitemapPriority: 0.76,
  },
];

export const allMarketingPages = [homepage, ...marketingPages] as const;

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : "/" + path;
  return new URL(normalizedPath, siteConfig.baseUrl).toString();
}

export function getMarketingPage(path: string) {
  return allMarketingPages.find((page) => page.path === path) ?? null;
}

export function requireMarketingPage(path: string) {
  const page = getMarketingPage(path);
  if (!page) throw new Error("Missing marketing page config for " + path);
  return page;
}

export function metadataFor(page: MarketingPage): Metadata {
  return {
    title: page.metaTitle,
    description: page.description,
    keywords: ["real estate chatbot", "real estate lead capture", "AI real estate assistant", "real estate website widget", "real estate QR code leads"],
    alternates: { canonical: absoluteUrl(page.path) },
    openGraph: {
      type: "website",
      url: absoluteUrl(page.path),
      title: page.metaTitle,
      description: page.description,
      siteName: siteConfig.name,
      images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: siteConfig.name + " product preview" }],
    },
    twitter: { card: "summary_large_image", title: page.metaTitle, description: page.description, images: [absoluteUrl("/opengraph-image")] },
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: siteConfig.baseUrl,
    description: siteConfig.description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/PreOrder" },
    audience: { "@type": "Audience", audienceType: "Real estate agents, teams, brokerages, and agencies" },
    featureList: ["Hosted real estate chatbot links", "Website chatbot widget", "QR and campaign tracking", "Buyer and seller qualification", "Appointment requests", "Email follow-up workflow", "Workspace roles and routing", "Billing entitlements"],
  };
}

export function faqJsonLd(page: MarketingPage) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
  };
}

export function webPageJsonLd(page: MarketingPage) {
  return { "@context": "https://schema.org", "@type": "WebPage", name: page.title, url: absoluteUrl(page.path), description: page.description, isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.baseUrl } };
}

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
