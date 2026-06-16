"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className="h-11 rounded-md border border-[#cbd5c7] bg-white px-3 text-sm font-semibold hover:bg-[#f2f5ee]" onClick={copy} type="button">
      {copied ? "Copied" : label}
    </button>
  );
}
