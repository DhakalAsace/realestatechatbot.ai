import { expect, test } from "@playwright/test";
import { requiredPhase9Paths } from "@/lib/marketing";

test.describe("Phase 9 SEO and product-led pages", () => {
  test("homepage has canonical metadata, schema, and product CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Turn real estate traffic into qualified appointments/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Try sample bot" }).first()).toHaveAttribute("href", "/c/sarah-patel");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /localhost:3000\/?$/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(3);
  });

  test("all required Phase 9 pages render with canonical tags and unique intent copy", async ({ page }) => {
    for (const path of requiredPhase9Paths) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(path.replaceAll("/", "\\/")));
      await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
    }
  });

  test("template generator creates a useful real estate script", async ({ page }) => {
    await page.goto("/tools/real-estate-chatbot-template-generator");
    await page.getByLabel("Lead goal").selectOption("open-house");
    await page.getByLabel("City or service area").fill("Calgary");
    await page.getByLabel("Brokerage or team").fill("Prairie Homes");
    await expect(page.getByText("Open house QR chatbot for Prairie Homes in Calgary")).toBeVisible();
    await expect(page.getByText("Attribute the lead to the QR channel")).toBeVisible();
  });

  test("robots, sitemap, and customer bot noindex behavior are aligned", async ({ page }) => {
    const robots = await page.request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    const robotsText = await robots.text();
    expect(robotsText).toContain("Sitemap:");
    expect(robotsText).toContain("Disallow: /dashboard/");

    const sitemap = await page.request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    const sitemapText = await sitemap.text();
    for (const path of requiredPhase9Paths) expect(sitemapText).toContain(path);
    expect(sitemapText).toContain("<loc>http://localhost:3000/</loc>");
    expect(sitemapText).not.toContain("/c/sarah-patel");

    await page.goto("/c/sarah-patel");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
