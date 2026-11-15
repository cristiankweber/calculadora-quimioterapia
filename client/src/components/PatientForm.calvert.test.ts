import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { it, expect, vi, afterEach } from "vitest";
import PatientForm from "./PatientForm";
const data = {
  name: "Fictício",
  age: 60,
  sex: "M",
  weight: 100,
  height: 190,
  creatinine: 1,
  bilirubin: 1,
  ecog: 0,
  comorbidities: "",
  calvertGfrAbsolute: 113.6,
} as any;
afterEach(() => vi.unstubAllGlobals());
it("oferece campo explícito em mL/min quando um protocolo legado usa AUC", () => {
  vi.stubGlobal("React", React);
  const html = renderToStaticMarkup(
    React.createElement(PatientForm, {
      data,
      onChange: () => {},
      showCalvertGfr: true,
    } as any)
  );
  expect(html).toContain("calvert-gfr-absolute");
  expect(html).toContain("113.6");
  expect(html).toContain("GFR absoluto");
  expect(html).toContain("indexado");
});
it("não oferece um segundo campo Calvert fora do modo legado AUC", () => {
  vi.stubGlobal("React", React);
  const html = renderToStaticMarkup(
    React.createElement(PatientForm, {
      data,
      onChange: () => {},
      showCalvertGfr: false,
    } as any)
  );
  expect(html).not.toContain("calvert-gfr-absolute");
});
