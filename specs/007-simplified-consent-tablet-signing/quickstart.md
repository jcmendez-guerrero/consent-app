# Quickstart: Validating Feature 007

**Feature**: 007-simplified-consent-tablet-signing | **Date**: 2026-11-04

A runnable validation guide. It proves the feature end to end; it does not contain implementation code. Entity details are in [data-model.md](data-model.md), endpoints in [contracts/](contracts/).

## Prerequisites

- Node.js 22 and a local checkout on branch `007-simplified-consent-tablet-signing`.
- Access to a non-production Azure SQL database (the connection settings used by `server/db/pool.js`).
- A counter workstation browser and a **real** phone or tablet on the same Wi-Fi or on mobile data, both able to sign in through Easy Auth (use the deployed test environment for the tablet checks; Easy Auth is not present on `localhost`, where `X-MS-CLIENT-PRINCIPAL-NAME` is missing and `creado_por` stays null).
- The review of the new legal wording by the person responsible has been recorded (a release gate, not a test gate).

## 1. Build, lint and automated checks

```bash
npm install
npm run db:migrate
npx eslint .
npm run build
node --test tests/unit
```

Expected:

- Migration `0005_acceptance_blocks_charges_signing.sql` applies once and is listed in `dbo.__migrations`; running it again does nothing.
- Lint and build succeed. Note the bundle size delta against the previous build in the PR description (constitution IV: justify if growth exceeds 10 %).
- Unit tests pass for the retained-amount and session-state-machine modules (see cases in section 7).

## 2. Run the app

```bash
npm run dev
```

and, for the API, `npm start` (or the deployed test environment). Sign in as a staff member.

## 3. Scenario A: Collapsed terms, separate privacy and photos (Stories 1, 2)

1. Open **1 · Consentimiento** and enter a new client and pet.
2. Verify the acceptance step shows exactly three items: terms block, privacy block, photos block, each collapsed with a summary, and no per-clause accept/refuse buttons.
3. Expand the terms block: clauses 1–5 are present with their original wording. Collapse it again.
4. Try to finish with nothing accepted: the action is blocked with a visible message (not colour only).
5. Accept terms and privacy, leave photos untouched, and finish. Confirm in the client list that the consent is active and photos are **not** authorized.
6. Repeat with another pet of the same client: the privacy block is not shown again.
7. Repeat with a new client: refuse the terms ⇒ the consent is recorded as refused and the intake cannot open for that pet.
8. Re-open the previous (pre-feature) consent for a legacy client: it still shows its old per-clause answers and is still valid; no re-acceptance is requested.

## 4. Scenario B: Store device signing (Story 5)

1. On the counter, prepare a new consent and choose **Firmar en dispositivo de la tienda**. A QR appears; status "esperando".
2. On the tablet, scan the QR. The counter status changes to "conectada" within 3 s. The tablet shows only that consent, no navigation tabs.
3. On the tablet: answer the three blocks, sign as tutor, hand over, sign as store, send.
4. On the counter, the consent appears as signed within 5 s (SC-006), with both signatures, without re-typing. Save it and open the generated PDF: both signatures, three decisions, `LEGAL_VERSION`, date and time.
5. Abandon test (repeat 10 times, SC-007): start a session and then (a) close the tablet tab, (b) switch the tablet to airplane mode, (c) wait 10 minutes without touching it, (d) cancel on the counter. In every case the consent is **not** recorded as accepted and the tablet shows no personal data after its next request.
6. Version skew: load the tablet screen, then deploy or simulate a changed `LEGAL_VERSION` on the counter; submit from the tablet. The counter must reject the result with a refresh message and save nothing.
7. Concurrency: open two sessions with two devices at once; each result reaches only its own consent.
8. Offline fallback: disconnect the tablet and choose **Imprimir en papel**; the paper flow works as before, with three decision boxes plus signature lines.
9. Security: open `/firmar/<token>` in a private window with no staff sign-in ⇒ Easy Auth login, not the document. Guess a modified token ⇒ `404`.

## 5. Scenario C: Ficha de Ingreso, surcharges and interruption (Stories 3, 4)

Prerequisite: a pet with an active consent.

1. Open **2 · Ingreso**. The intake conditions appear as one collapsed block with one acceptance. Expand it and confirm the handling-surcharge, medical-treatment and interruption conditions are present, and that it states signing does not accept the charge.
2. Enter estimated duration 60 min, price 40 €, and tick "tutor informed of behaviour". Add an upfront treatment: "Baño medicado", 12 €, origin "prescription", reference "Rec-1". Try saving it without origin ⇒ blocked.
3. Accept and sign (paper or tablet). The visit appears among open visits.
4. Open the visit's incident page and press **Iniciar servicio** at 10:00.
5. Handling surcharge, accepted: record a phone contact ("acepta"), apply the surcharge ⇒ 10 € added. Try a second one ⇒ blocked.
6. New visit, handling surcharge declined: record contact "rechaza", apply, then interrupt at 10:30 with duration 60 and behaviour disclosed ⇒ calculated retained amount is 20 € (50 % of 40 €). Confirm and check **Entrega** shows the retained amount and the interruption note.
7. New visit, tutor unreachable: record three contacts "no localizado" ⇒ interruption allowed; with behaviour **not** disclosed the retained amount equals the full price.
8. Parasite case: mark parasites detected, record a contact "informado". Try to apply the special treatment ⇒ blocked until a contact "acepta" exists. Then with tutor not reaching approval, record the groomer decision "continuar baño normal" with a reason ⇒ allowed without tutor approval; and in another visit "detener" ⇒ interruption flow applies the same rule.
9. Legacy visit: open an incident page for a visit created before this release ⇒ blocked with the explanation that the Ficha de Ingreso with the surcharge conditions must be accepted first (FR-025).
10. **Entrega**: for a visit with an upfront treatment, an accepted handling surcharge and a late pick-up, the card lists each line and the total equals their sum (SC-008).

## 6. Regression checklist (constitution gates)

- [ ] Consentimiento, Ingreso and Entrega flows complete end to end on the counter device and on the tablet.
- [ ] Consent-blocking guard: opening `/ingreso?mascota=<id>` for a pet without an active consent redirects/blocks.
- [ ] Photos checkbox is never pre-selected; `autoriza_fotos_redes` on a visit reflects the consent's value, never `true` by default.
- [ ] `LEGAL_VERSION` was incremented in the same commit as any `legal.js` text change.
- [ ] ARCO+ export (`GET /api/clientes/:id/export`) includes charges, contacts and the new visit fields; full suppression removes them; consent revocation still works.
- [ ] SiWeb360 sync still runs on consent save and ignores the new data.
- [ ] PDF generation under 3 s for the consent, the Ficha de Ingreso and the delivery document.
- [ ] Signature pad at 60 fps on the target tablet (no visible lag while drawing).
- [ ] Touch targets are at least 44×44 px on the tablet screen.
- [ ] Documentación page shows the updated blank templates and the tablet instructions.

## 7. Unit test cases for pure functions

Retained amount (`calcularImporteRetenido`):

| Price | Estimated min | Start | Interruption | Behaviour disclosed | Expected |
|-------|---------------|-------|--------------|---------------------|----------|
| 40 | 60 | 10:00 | 10:30 | yes | 20.00 |
| 40 | 60 | 10:00 | 10:30 | no | 40.00 |
| 40 | 60 | 10:00 | 11:30 | yes | 40.00 (capped) |
| 40 | 60 | 23:50 | 00:20 | yes | 20.00 (crosses midnight) |
| 45 | 90 | 09:00 | 09:20 | yes | 10.00 (rounded to cents) |

Visit total (`calcularTotalVisita`): accepted and `acordado_ingreso` charges are summed; `rechazado` and `no_localizado` are not; an interrupted visit uses the retained amount as base; the late-pickup charge is added unchanged.

Session state machine: allowed transitions only as drawn in the data model; expired sessions reject `enviar`; a consumed result cannot be read twice; terminal states have empty payload and result.

## 8. Done when

- All scenarios above pass on the real tablet and counter, with results noted in the PR description.
- Bundle size delta is noted; no unexplained growth above 10 %.
- The legal wording review for the new conditions is recorded before production deployment.
