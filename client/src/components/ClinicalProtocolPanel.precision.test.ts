import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { it, expect, vi } from "vitest";
import ClinicalProtocolPanel from "./ClinicalProtocolPanel";
it("não arredonda uma dose pronta de 1e-7 mg a zero no painel", () => {
  vi.stubGlobal("React", React);
  try {
    const row = {
      source: { id: "ficticio", name: "Fixture", doseUnit: "mg", route: "IV" },
      status: "ready",
      issues: [],
      dose: 1e-7,
      doseUnit: "mg",
      calculatedDose: 1e-7,
      dailyDose: 1e-7,
      resultUnit: "mg",
      frequency: 1,
      scheduledDays: [1],
      timeOrigin: "cycle_day_one",
    };
    const html = renderToStaticMarkup(
      React.createElement(ClinicalProtocolPanel, {
        document: {
          id: "ficticio",
          name: "Fixture",
          drugs: [],
          cycleLength: 21,
          cycles: 1,
        },
        resolution: { rows: [row], issues: [], prescriptionBlocked: false },
        context: { cycle: 1, day: 1 },
        onContextChange: () => {},
      } as any)
    );
    expect(html).toMatch(/(?:1e-7|0,0000001) mg/);
  } finally {
    vi.unstubAllGlobals();
  }
});
