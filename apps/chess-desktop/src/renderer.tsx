import React from "react";
import { createRoot } from "react-dom/client";
import { ChessApp } from "./ChessApp";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Missing root element.");
}

createRoot(root).render(
  <React.StrictMode>
    <ChessApp />
  </React.StrictMode>
);
