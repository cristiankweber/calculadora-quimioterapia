import { readFileSync } from "node:fs";
import { convertToUserTemplatePackage } from "../../server/seedSystemProtocols";
const source = JSON.parse(
  readFileSync(
    new URL(
      "../fixtures/user-templates-source-2026-11-14.json",
      import.meta.url
    ),
    "utf8"
  )
);
const converted = convertToUserTemplatePackage(source);
const records: any[] = [];
for (const pack of converted.packages ?? [converted]) {
  const { protocols, ...envelope } = pack;
  for (const doc of protocols)
    records.push({
      ...doc,
      id: records.length + 1,
      protocolId: `template-p1-fixture-${doc.id}`,
      userId: 7,
      isActive: 1,
      isSystem: 0,
      clinicalDocument: doc,
      clinicalPackage: envelope,
    });
}
console.log(JSON.stringify(records));
