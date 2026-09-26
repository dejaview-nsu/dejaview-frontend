import { createRoot } from "react-dom/client";

import { App } from "./application";
import "./index.css";

const container = document.querySelector("#root");
if (!container) {
  throw new Error("Root container #root not found");
}

createRoot(container).render(<App />);
