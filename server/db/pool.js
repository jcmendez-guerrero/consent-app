import sql from 'mssql';

const server = process.env.SQL_SERVER || 'azusqlsappconsentnp01.database.windows.net';
const database = process.env.SQL_DATABASE || 'azu-sql-consent-app-01';

let poolPromise = null;

// Modo SQL-auth: solo para desarrollo local puntual (nunca activar en el App Service
// real — la app en Azure siempre usa la Managed Identity del propio App Service).
function buildConfig() {
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
  // Usamos 'azure-active-directory-default': tedious obtiene (y refresca) el token
  // internamente vía @azure/identity en CADA conexión nueva del pool, evitando el
  // "Token is expired" que provocaba cachear un único token de acceso estático.
  return {
    server,
    database,
    options: { encrypt: true, trustServerCertificate: false },
    authentication: {
      type: 'azure-active-directory-default',
      options: {
        // Opcional: fija la identidad gestionada asignada por el usuario si aplica.
        clientId: process.env.AZURE_CLIENT_ID,
      },
    },
  };
}

export async function getPool() {
  if (poolPromise) return poolPromise;
  const config = buildConfig();
  poolPromise = sql.connect(config).catch((err) => {
    poolPromise = null; // permite reintentar (con token fresco) en la siguiente llamada
    throw err;
  });
  return poolPromise;
}

export { sql };
