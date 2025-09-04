// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
      <App />
  );
} else {
  throw new Error("Root element with id 'root' not found");
}
