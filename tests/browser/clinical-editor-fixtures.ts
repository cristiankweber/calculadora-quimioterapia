import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  convertToUserTemplatePackage,
  convertImportToDbRecords,
  protocolContentSha256,
} from "../../server/seedSystemProtocols";
import {
  listTemplateClinicalFields,
  applyTemplateClinicalChanges,
} from "../../shared/clinicalProtocols/templateClinicalRevision";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
const collection = JSON.parse(
  fs.readFileSync(
    path.join(root, "tests/fixtures/user-templates-source-2026-11-14.json"),
    "utf8"
  )
);
const sourcePackage = collection.packages.find((pkg: any) =>
  pkg.protocols.some((p: any) => p.name === "BuEM")
);
const original = sourcePackage.protocols.find((p: any) => p.name === "BuEM");
const selected = structuredClone(original);
selected.id = "BUEM-SOFTWARE-TEST";
selected.name = "BuEM FICTÍCIO — TESTE DO EDITOR";
const record = {
  ...convertImportToDbRecords(
    convertToUserTemplatePackage({ ...sourcePackage, protocols: [selected] }),
    7
  )[0],
  id: 701,
};
const prepare = {
  id: record.id,
  name: record.name,
  expectedHash: protocolContentSha256(record.clinicalDocument),
  fields: listTemplateClinicalFields(record.clinicalDocument),
};
if (process.argv.includes("--apply")) {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  console.log(
    JSON.stringify(
      applyTemplateClinicalChanges(record.clinicalDocument, input.changes)
    )
  );
} else console.log(JSON.stringify({ record, prepare }));
