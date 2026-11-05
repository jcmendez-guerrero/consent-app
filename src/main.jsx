import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { DirtyProvider } from "./contexts/DirtyContext.jsx";
import "./index.css";

// Si se accede directamente a una ruta sin hash (por ejemplo /firmar/:token escaneado desde el QR),
// redirigir de inmediato a la ruta con hash para que HashRouter la resuelva correctamente.
if (window.location.pathname.startsWith("/firmar/")) {
  const target = "/#" + window.location.pathname + window.location.search;
  window.location.replace(target);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <DirtyProvider>
          <App />
        </DirtyProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
);
