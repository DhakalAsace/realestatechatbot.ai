import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/safe-redirect";

describe("safeInternalPath", () => {
  it("allows dashboard-relative paths", () => {
    expect(safeInternalPath("/dashboard/leads?status=new#top")).toBe("/dashboard/leads?status=new#top");
  });

  it("rejects protocol-relative, absolute, and non-dashboard destinations", () => {
    expect(safeInternalPath("//evil.example/path")).toBe("/dashboard");
    expect(safeInternalPath("https://evil.example/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("/login")).toBe("/dashboard");
    expect(safeInternalPath("/\\evil")).toBe("/dashboard");
  });
});
