import {
  convertToUserTemplatePackage,
  convertImportToDbRecords,
  protocolContentSha256,
} from "../../server/seedSystemProtocols";
import { listTemplateDoseFields } from "../../shared/clinicalProtocols/templateDoseRevision";
const source = {
  version: "2.18",
  protocols: [
    {
      id: "DOSE-EDIT-TEST",
      name: "TEMPLATE FICTÍCIO DOS FLUXOS",
      indication: "Somente teste de interface — sem validade clínica",
      cycles: 2,
      cycleLength: 21,
      emetogenicRisk: "minimal",
      drugs: [
        {
          id: "fixture-a",
          name: "MEDICAMENTO FICTÍCIO",
          dose: 10,
          doseUnit: "mg",
          route: "VO",
          days: "1-2",
          maxDose: 25,
          administrationFrequency: {
            administrationsPerDay: 2,
            doseRepresents: "per_administration",
            continuousInfusion: false,
          },
          schedule: [
            { dose: 10, days: [1], timeOrigin: "cycle_day_one" },
            { dose: 20, days: [2], timeOrigin: "cycle_day_one" },
          ],
        },
      ],
    },
  ],
};
const record = {
  ...convertImportToDbRecords(convertToUserTemplatePackage(source), 7)[0],
  id: 701,
};
const prepare = {
  id: record.id,
  protocolId: record.protocolId,
  name: record.name,
  expectedHash: protocolContentSha256(record.clinicalDocument),
  fields: listTemplateDoseFields(record.clinicalDocument as any),
};
console.log(JSON.stringify({ record, prepare }));
