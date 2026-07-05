# Despliegue en Azure — DermoSpa (Mundo Mascotix)

Instrucciones para desplegar y mantener la app en Azure App Service con Azure SQL
Database. Reflejan exactamente el despliegue ya realizado en el entorno actual.

## Recursos de Azure implicados

| Recurso | Nombre |
|---|---|
| Resource Group (app) | `azu-rg-app-consent-np-01` |
| Resource Group (red) | `azu-rg-vnet-np-01` |
| Región | Spain Central |
| App Service | `dermospa-mundo-mascotix` |
| URL pública | `https://dermospa-mundo-mascotix-bpbhaabdewa4cdgg.spaincentral-01.azurewebsites.net` |
| Servidor SQL | `azusqlsappconsentnp01.database.windows.net` |
| Base de datos | `azu-sql-consent-app-01` |
| VNet | `azu-vnet-np-01` |
| Private Endpoint (SQL) | `azu-pe-sqldb-app-consent-np-01` |

---

## 1. Configuración inicial (ya hecha una vez — solo referencia)

Estos pasos ya se ejecutaron sobre el entorno actual. Solo hace falta repetirlos si
se crea un App Service o una base de datos nuevos desde cero.

### 1.1 Managed Identity del App Service

```bash
az webapp identity assign \
  --name dermospa-mundo-mascotix \
  --resource-group azu-rg-app-consent-np-01
```

Anota el `principalId` que devuelve.

### 1.2 Variables de entorno del App Service

```bash
az webapp config appsettings set \
  --name dermospa-mundo-mascotix \
  --resource-group azu-rg-app-consent-np-01 \
  --settings \
    SQL_SERVER=azusqlsappconsentnp01.database.windows.net \
    SQL_DATABASE=azu-sql-consent-app-01 \
    WEBSITE_NODE_DEFAULT_VERSION=~20 \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

No hace falta ninguna variable con usuario/contraseña de SQL: la app se autentica
con la Managed Identity.

### 1.3 Usuario de la Managed Identity dentro de la base de datos

Hay que ejecutarlo conectado como el administrador de Azure AD del servidor SQL
(no como la propia Managed Identity, que todavía no existe como usuario). Desde una
máquina con Node y con `az login` hecho como ese administrador:

```bash
node -e "
import('./server/db/pool.js').then(async ({ getPool }) => {
  const pool = await getPool();
  await pool.request().query('CREATE USER [dermospa-mundo-mascotix] FROM EXTERNAL PROVIDER');
  await pool.request().query('ALTER ROLE db_datareader ADD MEMBER [dermospa-mundo-mascotix]');
  await pool.request().query('ALTER ROLE db_datawriter ADD MEMBER [dermospa-mundo-mascotix]');
  console.log('Usuario creado y roles asignados.');
  process.exit(0);
}).catch((e) => { console.error(e.message); process.exit(1); });
"
```

Si el firewall del servidor SQL bloquea tu IP, añade una regla temporal:

```bash
az sql server firewall-rule create \
  --resource-group azu-rg-app-consent-np-01 \
  --server azusqlsappconsentnp01 \
  --name TempAccess \
  --start-ip-address <TU_IP> \
  --end-ip-address <TU_IP>
```

y bórrala después con `az sql server firewall-rule delete`.

### 1.4 Esquema de la base de datos

```bash
npm run db:migrate
```

Aplica `server/db/migrations/0001_init.sql` (crea las tablas `clientes`, `mascotas`,
`consentimientos`, `visitas`). Solo hace falta ejecutarlo una vez por base de datos,
y de nuevo cada vez que se añada un fichero de migración nuevo.

### 1.5 Red privada (VNet + Private Endpoint hacia SQL)

En este entorno ya estaba provisionada de antemano (VNet `azu-vnet-np-01`, subred
delegada para el App Service, Private Endpoint hacia SQL, zona DNS privada
`privatelink.database.windows.net` enlazada). Si hay que montarla desde cero en otro
entorno:

1. VNet con una subred delegada a `Microsoft.Web/serverFarms` (para el App Service) y
   otra para el Private Endpoint.
2. `az webapp vnet-integration add` conectando el App Service a su subred.
3. `az network private-endpoint create` para el servidor SQL, `--group-id SqlServer`,
   en la subred del Private Endpoint.
4. Zona DNS privada `privatelink.database.windows.net` enlazada a la VNet, con el
   grupo de zona DNS del Private Endpoint para que el registro A se cree solo.
5. Verificar resolución DNS y, cuando funcione, desactivar el acceso público del
   servidor SQL:
   ```bash
   az sql server update \
     --resource-group azu-rg-app-consent-np-01 \
     --name azusqlsappconsentnp01 \
     --enable-public-network-access false
   ```
   **Nota**: en el entorno actual este último paso se dejó pendiente a propósito
   (el acceso público sigue activo). Hazlo cuando quieras cerrar del todo el acceso.

### 1.6 Login con Azure AD / Entra ID (Easy Auth)

Desde el Portal: **App Service → Authentication → Add identity provider → Microsoft**
(modo Express, crea el App Registration automáticamente). Para restringir el acceso
solo a cuentas concretas del personal:

1. Entra ID → **Enterprise applications** → busca la app (`dermospa-mundo-mascotix`).
2. **Properties** → activa **"Assignment required?" = Yes**.
3. **Users and groups** → añade explícitamente las cuentas autorizadas.

**Nota**: en el entorno actual hay 2 cuentas ya asignadas, pero "Assignment
required" sigue en `No` — por ahora cualquier cuenta del tenant puede entrar.
Actívalo cuando quieras restringir de verdad el acceso a esas 2 cuentas.

---

## 2. Desplegar una actualización de código (proceso repetible)

Cada vez que haya cambios para publicar:

```bash
# 1. Desde la raíz del repo, generar el paquete de despliegue
#    (excluye node_modules, dist y .git — Oryx los reconstruye en el servidor)
rm -f /tmp/deploy.zip
zip -r -q /tmp/deploy.zip . \
  -x "node_modules/*" -x "dist/*" -x ".git/*" -x ".env" -x "*.DS_Store"

# 2. Desplegar
az webapp deploy \
  --name dermospa-mundo-mascotix \
  --resource-group azu-rg-app-consent-np-01 \
  --src-path /tmp/deploy.zip \
  --type zip
```

El comando puede tardar 1-3 minutos (Oryx ejecuta `npm install`, que a su vez
dispara `npm run build` vía el script `postinstall`, y luego arranca el servidor con
`npm start`). Si el CLI da un error de timeout (504) mientras compila, no significa
que haya fallado: comprueba el estado real con:

```bash
az webapp log deployment show \
  --name dermospa-mundo-mascotix \
  --resource-group azu-rg-app-consent-np-01
```

Busca la línea `"Deployment successful. deployer = OneDeploy"`.

### Ver logs en vivo

```bash
az webapp log tail \
  --name dermospa-mundo-mascotix \
  --resource-group azu-rg-app-consent-np-01
```

---

## 3. Verificación tras el despliegue

```bash
# El App Service debe estar "Running"
az webapp show --name dermospa-mundo-mascotix --resource-group azu-rg-app-consent-np-01 \
  --query "{state:state}" -o json

# Cualquier petición sin sesión debe devolver 401 (Easy Auth bloqueando el acceso)
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  https://dermospa-mundo-mascotix-bpbhaabdewa4cdgg.spaincentral-01.azurewebsites.net/
```

Para probar el flujo completo hay que entrar desde el navegador con una cuenta
autorizada — la app pedirá el login de Microsoft antes de mostrar nada.

---

## 4. Notas de seguridad y pendientes

- **Sin migración de datos**: la primera vez que se despliega sobre una base de
  datos nueva, hace falta ejecutar `npm run db:migrate` (paso 1.4) antes de que la
  app funcione — si no, las peticiones a `/api/*` fallarán con
  `Invalid object name 'dbo.clientes'`.
- **Acceso público a SQL**: sigue activo a propósito (ver 1.5). Desactivarlo cierra
  el acceso a cualquier herramienta que no pase por la VNet, incluido este mismo
  proceso de despliegue si alguna vez necesita conectarse directamente a la base de
  datos desde fuera.
- **Assignment required en Easy Auth**: sigue sin activar (ver 1.6). Mientras tanto,
  cualquier cuenta del tenant de Azure AD puede iniciar sesión en la app, no solo
  las cuentas ya asignadas.
- **Sin CI/CD**: el despliegue es manual (comando `az webapp deploy`). Si se quiere
  automatizar con GitHub Actions más adelante, se puede generar el *publish
  profile* del App Service y usar la acción oficial `azure/webapps-deploy`.
