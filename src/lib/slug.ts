export function slugify(value: string, fallback = "agent") {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/['?]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || fallback;
}

export function withShortSuffix(slug: string) {
  return `${slug}-${Math.random().toString(36).slice(2, 6)}`;
}
