import { createRoot } from "react-dom/client";

import { appStarted } from "@/shared/config/init";

import { App } from "./application";

const container = document.querySelector("#root");
if (!container) {
  throw new Error("Root container #root not found");
}

appStarted();
createRoot(container).render(<App />);
