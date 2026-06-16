const defaultSafePath = "/dashboard";

export function safeInternalPath(value: string | null | undefined, fallback = defaultSafePath) {
  if (!value) return fallback;

  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, "https://realestatechatbot.internal");
    if (parsed.origin !== "https://realestatechatbot.internal") return fallback;
    if (parsed.pathname !== "/" && !parsed.pathname.startsWith("/dashboard")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
