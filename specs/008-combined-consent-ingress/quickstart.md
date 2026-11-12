# Quickstart: Validating Feature 008

**Feature**: 008-combined-consent-ingress | **Date**: 2026-11-10

A runnable validation guide. It proves the feature end to end; it contains no implementation code. Entities are in [data-model.md](data-model.md), endpoints and screens in [contracts/](contracts/).

## Prerequisites

- Node.js 20 or newer, local checkout on branch `008-combined-consent-ingress` (or the session worktree).
- A non-production Azure SQL database and the deployed test environment. Easy Auth is absent on `localhost` (no `X-MS-CLIENT-PRINCIPAL-NAME`, `creado_por` stays null), so the tablet checks use the deployed test environment.
- A counter PC browser and a **real** phone or tablet, both signed in through Easy Auth.
- Test data only: use fictitious client and pet names; never real DNI/NIE values.
- Review of the single-signature wording by the person responsible for Mundo Mascotix recorded (release gate, not a test gate).

## 1. Automated checks

```bash
npm install
npm run db:migrate
npx eslint .
npm run build
npm test
```

Expected: migration 0007 applied, no lint errors, build succeeds (note bundle delta in the PR if above 10 %), unit tests pass including `registro-combinado.test.mjs` (decision matrix and snapshot equality).

## 2. Scenarios (manual, counter PC + real tablet)

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1 | Happy path, new client and pet (US1, SC-001/003) | Consentimiento → fill client and pet → "Consentimiento + ingreso (una firma)" → fill entry (service, price, duration, one upfront treatment) → "Firmar en móvil o tablet" → scan QR → accept all blocks → sign tutor, hand over, sign store | Counter shows pet admitted with valid consent; tutor signed once; one signing session; consent and visit rows share `firma_grupo_id`; both PDFs show the same signatures |
| 2 | Existing client, new pet (US1 #5) | Same with a client that has a valid privacy acceptance | Privacy block not shown on the tablet; consent has no `rgpd` answer; admitted |
| 3 | Paper fallback (US2) | Same data → "Imprimir documento combinado" → mark decisions on paper → confirm once on `/consentimiento/confirmar` | One sheet with one signature area; one confirmation creates consent and visit |
| 4 | Declines (US3, SC-005) | Run scenario 1 four times declining: terms; privacy (new client); intake conditions; nothing | Terms: consent `rechazado`, no visit. Privacy: nothing written, message shown. Intake: consent `aceptado`, no visit, message shown. All accepted: admitted |
| 5 | Abandon (US3, SC-004) | Start a session and: close the tablet tab; let it expire (10 min); cancel on the counter; close the modal before signing | No client, pet, consent or visit rows created; counter shows "not signed" and offers retry / paper / cancel (≥ 10 attempts at different points) |
| 6 | Entry data locked (Q3) | While the tablet shows the document, try to edit the form on the counter | Form not editable; closing the modal cancels the session and the tablet shows expired with no personal data; a new session shows the edited figures |
| 7 | Failed save and retry (Q2, FR-014) | Sign on the tablet, then force the save to fail (stop the DB connection or break the request), then restore and retry from the counter within 10 min; repeat letting more than 10 min pass | Within the window the retry saves both records without a new signature; after the window the endpoint answers 410, the session shows expired and `payload` / `resultado` are NULL |
| 8 | Stale tablet text (FR-010) | Open the tablet, change the legal version on the counter build, sign | Counter rejects with the "texto desactualizado" message and nothing is recorded |
| 9 | Tampered snapshot (FR-010/013, server) | Call the registration endpoint with an `entrada` that differs from the session payload | `409 no_coincide`, nothing written |
| 10 | Replay | Call the endpoint twice with the same session | Second call `409 sesion_no_firmada`; still one consent and one visit |
| 11 | Open visit (FR-019) | Combined path for a pet with an `ingresada` visit | Blocked with the same message as the separate entry flow |
| 12 | Regression: pet with valid consent (US4, FR-018) | `/ingreso?mascota=…` for a pet with a valid consent | Existing flow and its own signature; combined action not shown |
| 13 | Regression: consent only (FR-017) | "Solo consentimiento" for a new pet | Existing flow ends at `/ingreso?mascota=…` as before |
| 14 | Routing and server guard (constitution V, FR-025) | (a) Open `/ingreso` directly with no state and no pet. (b) Call `POST /api/visitas` directly for a pet with no active consent, and for a pet whose consent is revoked | (a) Existing "no valid consent" block; no way to open the intake form. (b) `409 sin_consentimiento`, no visit row written |
| 15 | Customer-management sync (FR-024) | Scenario 1 and 3 with the integration enabled | Contact synced once per consent (check the log); ambiguous contact shows the modal in the paper flow |
| 16 | Timing (SC-002) | Time scenario 1 from opening the document on the tablet to the pet admitted, and the old two-step flow, 5 runs each | Under 3 minutes, at least 40 % shorter than the old flow |
| 17 | Result latency (SC-006) | From "send" on the tablet to the admitted pet on the counter, 20 runs | Under 5 seconds in at least 95 % |
| 18 | Unsigned session left behind (FR-009) | Create a combined session (one left `esperando`, one opened on the tablet so it is `conectada`), never sign them, set their `expira_en` in the past, then restart the server (or wait up to 5 minutes) without creating another session | Both are `expirada` with `payload` and `resultado` NULL |
| 19 | No personal data in errors (R-13) | Send a registration whose client name is far longer than the column | `500` with the generic message; neither the response nor the server log contains the name |

## 3. Data checks

```sql
-- Two rows that share one group id, same signature images
SELECT c.id AS consentimiento, v.id AS visita, c.firma_grupo_id, v.firma_grupo_id AS visita_grupo,
       CASE WHEN c.firma = v.firma_ingreso_data THEN 1 ELSE 0 END AS misma_firma_tutor
FROM dbo.consentimientos c
JOIN dbo.visitas v ON v.firma_grupo_id = c.firma_grupo_id
WHERE c.firma_grupo_id IS NOT NULL;

-- No leftover personal data in finished combined sessions
SELECT id, estado, payload, resultado FROM dbo.sesiones_firma
WHERE tipo = 'ingreso_combinado' AND estado IN ('expirada', 'cancelada');
```

Expected: the first query shows `misma_firma_tutor = 1`; the second shows `payload` and `resultado` NULL on every row.

## 4. Device and constitution checks

- Signature capture and PDF generation exercised on the target tablet (constitution II); each PDF generated in under 3 seconds (IV).
- Touch targets ≥ 44 × 44 px on the tablet screen; photos unchecked by default; all times in Europe/Madrid; error and refusal messages visible without scrolling and not colour-only (III).
- `LEGAL_VERSION` incremented with the new clause (I, V); consent and visit each store version and hash.
- ARCO+ export and suppression run for a client created through the combined flow: both records appear in the export and are removed by suppression (V).
