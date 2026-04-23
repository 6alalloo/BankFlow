import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "reactflow/dist/style.css";
import "bootstrap/dist/css/bootstrap.min.css"; // Bootstrap global styles

import "./index.css";

import { AuthProvider } from "./contexts/AuthContext";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);