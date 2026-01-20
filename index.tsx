import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import "./src/index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find #root element");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Toaster position="top-right" richColors closeButton />
    <App />
  </React.StrictMode>
);
