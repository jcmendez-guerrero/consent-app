# Contract: Interfaces That Must Not Change

This feature adds no interface. It lists the externally observable behavior that the dependency upgrades must preserve, so reviewers can check "no regression" against something concrete.

## HTTP API (Express server)

| Aspect | Must stay the same |
|--------|--------------------|
| Routes | All paths and methods under `server/routes/*` (clientes, mascotas, consentimientos, visitas) and the CRM sync endpoints |
| Request parsing | JSON bodies and query strings parse to the same values for valid input (`body-parser`, `qs` upgrades are patch/minor) |
| Uploads | Consent file upload keeps the same field names and the 10 MB limit configured in `server/routes/consentimientos.js` (`multer`) |
| Rate limiting | HTTP 429 with the same message once the per-IP limit is exceeded; recovery after the window expires |
| Error responses | Same status codes and shape from `server/middleware/errorHandler.js` |

## Browser application

| Aspect | Must stay the same |
|--------|--------------------|
| Routes and guard | Same SPA routes; no active consent still redirects to the signing flow |
| PDFs | Consent, intake and delivery PDFs render the same layout, including both signatures; produced in < 3 s |
| Sanitized HTML | Any text passed through the sanitizer renders as before for valid input |
| Build output | `npm run build` succeeds; bundle size within +10 % |

## External integrations

| Integration | Must stay the same |
|-------------|--------------------|
| Azure Blob and SQL via `@azure/identity` | Credential acquisition, blob upload and database connection still work (this is the one transitive major bump, msal-node 5 → 7) |
| SiWeb360 CRM | Contact upsert and pet-as-notes flow unchanged |

## Out of contract

Development tooling versions (`vite`, `eslint`, `browserslist`) may change freely as long as `npm run build`, `npx eslint .` and the CI workflow pass.
