import sql from 'mssql';
import { DefaultAzureCredential } from '@azure/identity';

const SQL_TOKEN_SCOPE = 'https://database.windows.net/.default';

const server = process.env.SQL_SERVER || 'azusqlsappconsentnp01.database.windows.net';
const database = process.env.SQL_DATABASE || 'azu-sql-consent-app-01';

let poolPromise = null;

// Modo SQL-auth: solo para desarrollo local puntual (nunca activar en el App Service
// real — la app en Azure siempre usa la Managed Identity del propio App Service).
async function buildConfig() {
  if (process.env.SQL_AUTH_MODE === 'sql') {
    return {
      server,
      database,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false },
    };
  }

  // Managed Identity en Azure; az login / credenciales del desarrollador en local.
  const credential = new DefaultAzureCredential();
  const { token } = await credential.getToken(SQL_TOKEN_SCOPE);
  return {
    server,
    database,
    options: { encrypt: true, trustServerCertificate: false },
    authentication: {
      type: 'azure-active-directory-access-token',
      options: { token },
    },
  };
}

export async function getPool() {
  if (poolPromise) return poolPromise;
  const config = await buildConfig();
  poolPromise = sql.connect(config).catch((err) => {
    poolPromise = null; // permite reintentar (con token fresco) en la siguiente llamada
    throw err;
  });
  return poolPromise;
}

export { sql };
