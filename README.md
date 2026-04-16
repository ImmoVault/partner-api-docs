# messpunkt.io Partner API — Documentation

Draft OpenAPI specification and hosted reference for the **messpunkt.io Partner API** — a REST/OAuth 2.1 surface through which property-management ERPs read consumption and meter-reading data from messpunkt.io on behalf of a landlord.

| | |
|---|---|
| **Rendered docs** | https://immovault.github.io/partner-api-docs/ |
| **OpenAPI spec** | [erp-api-openapi.yaml](./erp-api-openapi.yaml) |
| **Status** | Draft 0.1 · April 2026 · **not yet implemented** |
| **Spec source of truth** | `ImmoVault/meter-etl` → `docs/erp-api-openapi.yaml` |

## What this is

The messpunkt.io Partner API lets property-management ERPs list units, query meter readings with explicit meter-replacement semantics, and use modern OAuth 2.1 + PKCE + DPoP auth instead of long-lived API keys.

Key design points:

- **One canonical data model, multiple renderings.** V1 is REST + OAuth for modern partners. V2 adds a BVED 3.10 push rendering for the ARGE-speaking long tail (ImmoWare24, ImmoCloud, Wodis Sigma …).
- **UsageUnit is the ERP-facing resource.** MeasuringPoints are the stable anchor across meter replacements.
- **Meter replacement is explicit in the schema.** Consumption responses are nested per-MeasuringPoint with device segments — ERPs never diff serials to detect a swap.
- **No static API keys.** OAuth 2.1 Authorization Code + PKCE; access tokens are DPoP-bound (RFC 9449) and scoped per Tenant.
- **OBIS-aligned metrics** (IEC 62056).

## Feedback

This is a concept draft. Feedback from integration partners is explicitly invited before implementation begins. Please reach out to the messpunkt.io integrations team.

## Licence & privacy

The specification is shared publicly for the purpose of partner implementation and review. No production credentials, endpoints or customer data are contained in this repository.
