/** Imported clinical drafts remain lossless. Textual guidance is not executable policy. */
export interface ClinicalAdministrationFrequency {
  administrationsPerDay?: number | null;
  continuousInfusion?: boolean;
  doseRepresents?: string | null;
  intervalHours?: number | null;
  [key: string]: unknown;
}

export interface ClinicalSchedule {
  dose?: number | null;
  doseUnit?: string;
  days?: number[] | string;
  dayFrom?: number | null;
  dayTo?: number | null;
  repeatEveryDays?: number | null;
  cycleFrom?: number | null;
  cycleTo?: number | null;
  cycleLength?: number | null;
  timeOrigin?: string;
  phase?: string;
  context?: string;
  administrationsPerDay?: number | null;
  administrationFrequency?: ClinicalAdministrationFrequency;
  frequency?: number | null | ClinicalAdministrationFrequency;
  doseRepresents?: string | null;
  continuousInfusion?: boolean;
  [key: string]: unknown;
}

export interface ClinicalDrug {
  id: string;
  name: string;
  dose: number | null;
  doseUnit: string;
  route: string;
  days: string;
  schedule?: ClinicalSchedule[];
  frequency?: number | null | ClinicalAdministrationFrequency;
  administrationFrequency?: ClinicalAdministrationFrequency;
  timeOrigin?: string;
  maxDose?: number | null;
  maxDoseUnit?: string;
  [key: string]: unknown;
}

export interface ClinicalPhase {
  id: string;
  name: string;
  drugs?: ClinicalDrug[];
  drugRefs?: string[];
  scheduleOverrides?: Array<{
    drugId: string;
    days?: number[] | string;
    [key: string]: unknown;
  }>;
  support?: Array<{
    name: string;
    dose?: number | null;
    doseUnit?: string;
    [key: string]: unknown;
  }>;
  cycleLength?: number | null;
  automaticPrescriptionAllowed?: boolean;
  [key: string]: unknown;
}

export interface ClinicalCalculationPolicy {
  automaticPrescriptionAllowed?: boolean;
  referenceOnly?: boolean;
  legacyImportSafetyVerified?: boolean;
  requiresScheduleAwareEngine?: boolean;
  unitsMustBeExplicit?: boolean;
  /** Stage > drug > selected phase policy > document policy; explicit null blocks execution. */
  doseRepresents?: string | null;
  renalOrHepaticAdjustmentAutomatic?: boolean;
  [key: string]: unknown;
}

export interface ClinicalReview {
  status?: string;
  scheduleStatus?: string;
  reviewedOn?: string;
  requiresMedicalApproval?: boolean;
  requiresPharmacyApproval?: boolean;
  calculatorIntegrationTested?: boolean;
  unresolvedItems?: string[];
  [key: string]: unknown;
}

export interface ClinicalSource {
  id?: string;
  name?: string;
  title?: string;
  url?: string;
  pages?: number[];
  [key: string]: unknown;
}

export interface ClinicalProtocolDocument {
  id: string;
  name: string;
  indication: string;
  cycles: number | null;
  cycleLength: number | null;
  drugs: ClinicalDrug[];
  phaseLibrary?: ClinicalPhase[];
  calculationPolicy?: ClinicalCalculationPolicy;
  review?: ClinicalReview;
  referenceOnly?: boolean;
  sources?: Array<string | ClinicalSource>;
  source?: string | ClinicalSource;
  sourceId?: string;
  sourcePages?: number[];
  [key: string]: unknown;
}

export interface ClinicalContext {
  cycle: number;
  /** Day in the row's declared timeOrigin. No automatic reset/offset between origins. */
  day?: number;
  phaseId?: string;
  bsa?: number;
  weight?: number;
  /** Indexed eGFR is informational only; never used in Calvert. */
  egfr?: number;
  /** Explicit absolute GFR (mL/min), selected for the Calvert calculation. */
  gfrForCalvert?: number;
}

export interface ResolvedClinicalDrug {
  /** Exact, unmodified drug object in the original document or selected phase. */
  source: ClinicalDrug;
  /** Declared dose for this calendar segment, before patient factors/division. */
  dose: number | null;
  /** Dose per administration, or undivided continuous/infusion total. */
  calculatedDose: number | null;
  resultUnit: string;
  frequency: number | null;
  /** Unidade e definição explícitas da etapa, que podem diferir da dose principal. */
  doseUnit?: string;
  doseRepresents?: string;
  continuousInfusion?: boolean;
  /** Explicit/computable 24h total; null for total_for_this_infusion. */
  dailyDose: number | null;
  days: string;
  issues: string[];
  status: "ready" | "not_scheduled" | "blocked";
  timeOrigin: string;
}

export interface ResolvedClinicalProtocol {
  rows: ResolvedClinicalDrug[];
  issues: string[];
  cycleLength: number | null;
  prescriptionBlocked: boolean;
}

/** Alias used by catalogue/panel consumers. */
export type ClinicalResolution = ResolvedClinicalProtocol;
