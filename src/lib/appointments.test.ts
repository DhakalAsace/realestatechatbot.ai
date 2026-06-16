import { describe, expect, it } from "vitest";
import { appointmentTypeLabel, detectAppointmentType, hasRequestedWindow, normalizeCalendarUrl } from "@/lib/appointments";

describe("appointments helpers", () => {
  it("detects appointment request types", () => {
    expect(detectAppointmentType("Can I book a consultation tomorrow?", { intent: "buyer" })).toBe("buyer_consultation");
    expect(detectAppointmentType("Can you prepare a valuation Monday?", { intent: "seller" })).toBe("seller_valuation");
    expect(detectAppointmentType("I want a showing this weekend", { intent: "buyer" })).toBe("showing");
  });

  it("detects requested windows", () => {
    expect(hasRequestedWindow("tomorrow afternoon")).toBe(true);
    expect(hasRequestedWindow("Friday at 3pm")).toBe(true);
    expect(hasRequestedWindow("whenever works")).toBe(false);
  });

  it("normalizes calendar URLs", () => {
    expect(normalizeCalendarUrl("https://calendly.com/agent/intro")).toBe("https://calendly.com/agent/intro");
    expect(normalizeCalendarUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeCalendarUrl("not a url")).toBeNull();
  });

  it("labels every appointment enum", () => {
    expect(appointmentTypeLabel("buyer_consultation")).toBe("buyer consultation");
    expect(appointmentTypeLabel("seller_valuation")).toBe("seller valuation");
    expect(appointmentTypeLabel("showing")).toBe("showing");
    expect(appointmentTypeLabel("general_followup")).toBe("general follow-up");
  });
});
