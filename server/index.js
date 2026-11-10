import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRouter from "./routes/auth.js";
import clientesRouter from "./routes/clientes.js";
import mascotasRouter from "./routes/mascotas.js";
import consentimientosRouter from "./routes/consentimientos.js";
import visitasRouter from "./routes/visitas.js";
import tratamientosRouter from "./routes/tratamientos.js";
import siweb360Router from "./routes/siweb360.js";
import firmaRouter, { limpiarSesionesCombinadas } from "./routes/firma.js";
import { getPool } from "./db/pool.js";
import registrosCombinadosRouter from "./routes/registrosCombinados.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { rateLimiter, firmaRateLimiter } from "./middleware/rateLimiter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// App Service pone un proxy delante: sin esto el limitador ve la IP del proxy y
// cuenta a todos los usuarios como uno solo.
app.set("trust proxy", 1);

// Los ficheros estáticos van antes de los limitadores: no deben gastar su cupo.
const distDir = path.join(__dirname, "../dist");
app.use(express.static(distDir));

// Las firmas van como PNG en base64 dentro del JSON; el límite por defecto de
// Express (100kb) se queda corto.
app.use(express.json({ limit: "5mb" }));

// Rate limiter específico para firma antes del rate limiter global
app.use("/api/firma", firmaRateLimiter, firmaRouter);

app.use(rateLimiter);

app.use("/api/me", authRouter);
app.use("/api/clientes", clientesRouter);
app.use("/api/mascotas", mascotasRouter);
app.use("/api/consentimientos", consentimientosRouter);
app.use("/api/visitas", visitasRouter);
app.use("/api/registros-combinados", registrosCombinadosRouter);
app.use("/api/tratamientos", tratamientosRouter);
app.use("/api/siweb360", siweb360Router);

app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.use(errorHandler);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`DermoSpa server escuchando en el puerto ${port}`);
});

// FR-009: los datos del registro pendiente no sobreviven a la caducidad de la sesión aunque nadie
// cree otra sesión. El registro del error solo lleva nombre y código (sin datos personales).
async function limpiarCombinadasCaducadas() {
  try {
    await limpiarSesionesCombinadas(await getPool());
  } catch (err) {
    console.error("[firma] no se pudo limpiar sesiones combinadas caducadas", {
      name: err?.name,
      code: err?.code,
    });
  }
}
limpiarCombinadasCaducadas();
setInterval(limpiarCombinadasCaducadas, 5 * 60 * 1000).unref();
