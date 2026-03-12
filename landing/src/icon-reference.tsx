import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IconReferencePage } from "./components/icon-reference-page.js";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <IconReferencePage />
  </StrictMode>,
);
