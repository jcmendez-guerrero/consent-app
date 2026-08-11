import sql from 'mssql';
import { DefaultAzureCredential } from '@azure/identity';

const SQL_TOKEN_SCOPE = 'https://database.windows.net/.default';

const server = process.env.SQL_SERVER || 'azusqlsappconsentnp01.database.windows.net';
const database = process.env.SQL_DATABASE || 'azu-sql-consent-app-01';

let poolPromise = null;

// Modo SQL-auth: solo para desarrollo local puntual (nunca activar en el App Service
// real — la app en Azure siempre usa la Managed Identity del propio App Service).
// La base de datos es Serverless (GP_S_Gen5) con auto-pause: tras inactividad se
// pausa, y la primera conexión que llega la despierta, lo que puede tardar hasta
// ~30-60s. Con el timeout por defecto (15s) esa primera conexión falla con
// ETIMEOUT. Se sube el timeout y se reintenta una vez para no propagar el error.
const CONNECT_TIMEOUT_MS = 60000;

async function buildConfig() {
  if (process.env.SQL_AUTH_MODE === 'sql') {
    return {
      server,
      database,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      connectionTimeout: CONNECT_TIMEOUT_MS,
      requestTimeout: CONNECT_TIMEOUT_MS,
      options: { encrypt: true, trustServerCertificate: false },
    };
  }

  // Managed Identity en Azure; az login / credenciales del desarrollador en local.
  const credential = new DefaultAzureCredential();
  const { token } = await credential.getToken(SQL_TOKEN_SCOPE);
  return {
    server,
    database,
    connectionTimeout: CONNECT_TIMEOUT_MS,
    requestTimeout: CONNECT_TIMEOUT_MS,
    options: { encrypt: true, trustServerCertificate: false },
    authentication: {
      type: 'azure-active-directory-access-token',
      options: { token },
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getPool() {
  if (poolPromise) return poolPromise;
  poolPromise = (async () => {
    const config = await buildConfig();
    try {
      return await sql.connect(config);
    } catch (err) {
      // Reintento único: cubre el caso típico de que la base de datos serverless
      // estuviera pausada y la primera conexión la haya despertado pero no llegado a tiempo.
      await sleep(5000);
      const retryConfig = await buildConfig();
      return await sql.connect(retryConfig);
    }
  })().catch((err) => {
    poolPromise = null; // permite reintentar (con token fresco) en la siguiente llamada
    throw err;
  });
  return poolPromise;
}

export { sql };
