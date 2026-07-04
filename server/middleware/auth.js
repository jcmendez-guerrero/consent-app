// Easy Auth (App Service Authentication) inyecta esta cabecera en cada petición
// una vez el usuario ha iniciado sesión con Entra ID. En local (sin Easy Auth
// delante) simplemente no existe y currentUser devuelve null.
export function currentUser(req) {
  return req.header('X-MS-CLIENT-PRINCIPAL-NAME') || null;
}
