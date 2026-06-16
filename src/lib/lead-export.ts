import type { LeadRow } from "@/lib/data/dashboard";

export const leadExportColumns = [
  "created_at",
  "name",
  "email",
  "phone",
  "status",
  "temperature",
  "intent",
  "score",
  "location",
  "timeframe",
  "budget_min",
  "budget_max",
  "property_type",
  "property_address",
  "source_label",
  "source",
  "medium",
  "campaign",
  "term",
  "assigned_agent_profile_id",
  "summary",
] as const;

export type LeadExportColumn = (typeof leadExportColumns)[number];
export type LeadExportRow = Pick<LeadRow, LeadExportColumn>;

export function leadsToCsv(leads: LeadExportRow[]) {
  const header = leadExportColumns.join(",");
  const rows = leads.map((lead) => leadExportColumns.map((column) => csvCell(lead[column])).join(","));
  return [header, ...rows].join("\n") + "\n";
}

export function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\r?\n/g, " ");
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  if (/[",\n]/.test(safeText)) return `"${safeText.replaceAll('"', '""')}"`;
  return safeText;
}
