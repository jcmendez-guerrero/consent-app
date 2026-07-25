# Data Model: Fix Security Alerts

**Feature**: 003-fix-security-alerts | **Date**: 2026-07-06

This feature introduces no new data entities and modifies no existing data schemas. It is purely a dependency upgrade and middleware addition.

## Rate Limiter Configuration (runtime state, not persisted)

The rate limiter maintains an in-memory counter per IP address. This is ephemeral process state, not a data model in the traditional sense.

| Field | Value | Notes |
|-------|-------|-------|
| Window | 15 minutes | Rolling window |
| Max requests | 200 | Per IP per window |
| Store | In-memory (default) | Reset on server restart; adequate for single-instance deployment |
| Response on limit | HTTP 429 | `Too Many Requests` |

## Dependency Version Changes

| Package | Before | After | Change type |
|---------|--------|-------|-------------|
| `jspdf` | `^3.0.1` | `^4.2.1` | Major version upgrade |
| `express-rate-limit` | (not installed) | `^7.x` (latest stable) | New dependency |

## No Impacted Entities

- No changes to `dbo.consentimientos`, `dbo.clientes`, `dbo.mascotas`, or `dbo.visitas` schemas.
- No changes to `localStorage` structures.
- No changes to PDF output format or content.
- `LEGAL_VERSION` not incremented (no legal text changes).
