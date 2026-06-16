"use client";

import { useMemo, useState } from "react";

type Goal = "buyer" | "seller" | "open-house" | "valuation" | "property";

const goals: Record<Goal, { label: string; opener: string; fields: string[]; followUp: string }> = {
  buyer: { label: "Buyer lead", opener: "Hi, I can help narrow down the right homes. Are you looking to buy soon, or just starting your search?", fields: ["name", "email or phone", "preferred area", "budget", "timeline", "property type", "pre-approval status"], followUp: "Route to the assigned buyer agent and offer a consultation or showing request." },
  seller: { label: "Seller lead", opener: "Hi, I can help connect you with the right agent. Are you thinking about selling a property?", fields: ["name", "email or phone", "property address or area", "selling timeline", "valuation interest"], followUp: "Route to the listing agent and create a seller valuation follow-up state if consent exists." },
  "open-house": { label: "Open house QR", opener: "Welcome to the open house. Would you like details, a private showing, or follow-up from the agent?", fields: ["name", "email or phone", "buyer/seller intent", "showing interest", "timeline", "agent follow-up consent"], followUp: "Attribute the lead to the QR channel and trigger open-house follow-up when explicitly allowed." },
  valuation: { label: "Home valuation", opener: "I can help start a valuation request. What city or neighbourhood is the property in?", fields: ["name", "email or phone", "property area", "address if comfortable", "selling timeline", "valuation goal"], followUp: "Do not invent a value. Send the details to an agent for a real valuation conversation." },
  property: { label: "Property recommendation", opener: "Tell me what kind of property you want and I will collect the details for the agent.", fields: ["name", "email or phone", "area", "budget", "property type", "must-haves", "timeline"], followUp: "Only mention controlled property records that exist; otherwise route to the agent with the buyer preferences." },
};

export function TemplateGenerator() {
  const [goal, setGoal] = useState<Goal>("buyer");
  const [city, setCity] = useState("Winnipeg");
  const [brand, setBrand] = useState("Northline Realty");
  const selected = goals[goal];
  const script = useMemo(() => {
    const questions = selected.fields.map((field, index) => String(index + 1) + ". Ask for " + field + ".").join("\n");
    return selected.label + " chatbot for " + (brand || "your brokerage") + " in " + (city || "your market") + "\n\nOpening message:\n" + selected.opener + "\n\nQualification path:\n" + questions + "\n\nHandoff rule:\n" + selected.followUp;
  }, [brand, city, selected]);

  return <section className="border-b border-[#d9ded2] bg-white"><div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[360px_1fr]"><form className="rounded-lg border border-[#d9ded2] bg-[#f7f9f4] p-5" onSubmit={(event) => event.preventDefault()}><h2 className="text-xl font-semibold">Configure the template</h2><label className="mt-5 block text-sm font-semibold" htmlFor="goal">Lead goal</label><select className="mt-2 w-full rounded-md border border-[#cbd5c7] bg-white px-3 py-2" id="goal" value={goal} onChange={(event) => setGoal(event.target.value as Goal)}>{Object.entries(goals).map(([value, item]) => <option value={value} key={value}>{item.label}</option>)}</select><label className="mt-4 block text-sm font-semibold" htmlFor="city">City or service area</label><input className="mt-2 w-full rounded-md border border-[#cbd5c7] bg-white px-3 py-2" id="city" value={city} onChange={(event) => setCity(event.target.value)} /><label className="mt-4 block text-sm font-semibold" htmlFor="brand">Brokerage or team</label><input className="mt-2 w-full rounded-md border border-[#cbd5c7] bg-white px-3 py-2" id="brand" value={brand} onChange={(event) => setBrand(event.target.value)} /></form><div className="rounded-lg border border-[#cbd5c7] bg-[#10231b] p-5 text-white"><p className="font-mono text-xs uppercase tracking-[0.14em] text-[#b8d5c7]">Generated script</p><pre className="mt-4 whitespace-pre-wrap rounded-md bg-black/25 p-4 text-sm leading-6 text-[#f2f7f0]">{script}</pre></div></div></section>;
}
