import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRouter from './routes/auth.js';
import clientesRouter from './routes/clientes.js';
import mascotasRouter from './routes/mascotas.js';
import consentimientosRouter from './routes/consentimientos.js';
import visitasRouter from './routes/visitas.js';
import tratamientosRouter from './routes/tratamientos.js';
import siweb360Router from './routes/siweb360.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Las firmas van como PNG en base64 dentro del JSON; el límite por defecto de
// Express (100kb) se queda corto.
app.use(express.json({ limit: '5mb' }));
app.use(rateLimiter);

app.use('/api/me', authRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/mascotas', mascotasRouter);
app.use('/api/consentimientos', consentimientosRouter);
app.use('/api/visitas', visitasRouter);
app.use('/api/tratamientos', tratamientosRouter);
app.use('/api/siweb360', siweb360Router);

const distDir = path.join(__dirname, '../dist');
app.use(express.static(distDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.use(errorHandler);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`DermoSpa server escuchando en el puerto ${port}`);
});
