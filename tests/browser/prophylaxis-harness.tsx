import React from "react";
import { createRoot, type Root } from "react-dom/client";
import ProphylaxisAlerts from "../../client/src/components/ProphylaxisAlerts";
import type {
  Protocol,
  AntiemeticProphylaxis,
} from "../../client/src/types/calculator";
let root: Root | undefined;
export function showFixture(
  protocol: Protocol | null,
  antiemetics: AntiemeticProphylaxis | null
) {
  if (!root) {
    const container = document.createElement("div");
    container.id = "prophylaxis-test-root";
    Object.assign(container.style, {
      position: "fixed",
      inset: "0",
      zIndex: "9999",
      overflow: "auto",
      background: "white",
      padding: "24px",
    });
    document.body.append(container);
    root = createRoot(container);
  }
  root.render(
    <ProphylaxisAlerts protocol={protocol} antiemetics={antiemetics} />
  );
}
