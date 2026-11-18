/** Text-only projection. Risk/status never synthesizes medication orders or grants release. */
export type AntiemeticRisk = "high" | "moderate" | "low" | "minimal";

export interface TemplateAntiemetics {
  risk: AntiemeticRisk;
  day1: string[];
  days2to4: string[];
  rescue: string[];
  alerts: string[];
  timeReference?: string;
}

export const ANTIEMETIC_SECTION_NOTICES = {
  day1: "Não informado — conferir/cadastrar antieméticos do Dia 1.",
  days2to4: "Não informado — conferir/cadastrar antieméticos dos Dias 2-4.",
  rescue: "Não informado — conferir/cadastrar antieméticos de Resgate.",
} as const;
export const ANTIEMETIC_TIME_NOTICE =
  "Referência temporal não informada — conferir/cadastrar a origem dos dias antes de administrar; não presumir dia do ciclo, dia da quimioterapia ou D0 do transplante.";

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const own = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);
const texts = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((text): text is string => typeof text === "string")
        .map(text => text.trim())
        .filter(Boolean)
    : [];
const isRisk = (value: unknown): value is AntiemeticRisk =>
  value === "high" ||
  value === "moderate" ||
  value === "low" ||
  value === "minimal";

/**
 * Canonical root is authoritative whenever explicitly present, including null/invalid.
 * Only current extensions can supply a missing root; sourceDocument is archival and ignored.
 * Missing clinical orders stay empty. Generated notices live only in alerts.
 */
export function projectTemplateAntiemetics(
  document: unknown,
  risk?: AntiemeticRisk
): TemplateAntiemetics {
  const doc = asRecord(document);
  const anti = asRecord(
    own(doc, "antiemetics")
      ? doc.antiemetics
      : asRecord(doc.extensions).antiemetics
  );
  const day1 = texts(anti.day1);
  const days2to4 = texts(anti.days2to4);
  const rescue = texts(anti.rescue);
  const alerts = texts(anti.alerts);
  for (const [key, orders] of [
    ["day1", day1],
    ["days2to4", days2to4],
    ["rescue", rescue],
  ] as const)
    if (!orders.length && !alerts.includes(ANTIEMETIC_SECTION_NOTICES[key]))
      alerts.push(ANTIEMETIC_SECTION_NOTICES[key]);
  const timeReference =
    typeof anti.timeReference === "string" ? anti.timeReference.trim() : "";
  if (
    (day1.length || days2to4.length || rescue.length) &&
    !timeReference &&
    !alerts.includes(ANTIEMETIC_TIME_NOTICE)
  )
    alerts.push(ANTIEMETIC_TIME_NOTICE);
  return {
    risk: isRisk(doc.emetogenicRisk)
      ? doc.emetogenicRisk
      : isRisk(risk)
        ? risk
        : "minimal",
    day1,
    days2to4,
    rescue,
    alerts,
    ...(timeReference ? { timeReference } : {}),
  };
}
