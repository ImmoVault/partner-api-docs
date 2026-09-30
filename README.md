# messpunkt.io Partner API — Documentation

![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-1e534a?style=flat-square)
![OAuth](https://img.shields.io/badge/OAuth-2.1%20%2B%20PKCE-1e534a?style=flat-square)
![DPoP](https://img.shields.io/badge/DPoP-optional%20(RFC%209449)-1e534a?style=flat-square)
![AI-ready](https://img.shields.io/badge/AI--ready-tool%20schemas%20%2B%20llms.txt-1e534a?style=flat-square)
![Status](https://img.shields.io/badge/status-preview-f2c94c?style=flat-square)
![Version](https://img.shields.io/badge/V1-1.0.0--rc.3-2d9cdb?style=flat-square)

**Partner-facing API documentation for [messpunkt.io](https://messpunkt.io)** — the metering platform for German real estate. This repo hosts the OpenAPI 3.1 specification and the rendered documentation at **https://developer.messpunkt.io**.

## Why this matters

Property-management ERPs (Immobilienverwaltungs-Software) traditionally pull consumption data via legacy file exchanges or bespoke connectors. messpunkt.io exposes a **single, partner-agnostic REST/OAuth 2.1 API** that lets ERPs:

- List Liegenschaften (Properties) and Wohneinheiten (UsageUnits) under a landlord's Tenant
- Query monthly meter readings (Ablesungen) and billable period consumption with explicit meter-replacement semantics and measured-vs-calculated flags
- Connect via user-delegated OAuth (PKCE, DPoP optional) — no API keys on clipboards
- Limit exposure to a subset of Properties per connection via a token-scoped whitelist

One spec. One canonical data model. Multiple renderings (REST today; BVED 3.10 push for the ARGE-speaking long tail is designed in but deferred to V2).

## Rendered documentation

Same spec, three viewers for different audiences:

| URL | Viewer | Best for |
|---|---|---|
| [developer.messpunkt.io](https://developer.messpunkt.io/) | Redoc | Product, architect, narrative reading |
| [developer.messpunkt.io/swagger-ui/](https://developer.messpunkt.io/swagger-ui/) | Swagger UI | Backend developers, endpoint-list workflow |
| [developer.messpunkt.io/scalar/](https://developer.messpunkt.io/scalar/) | Scalar | Modern teams wanting code samples in curl / JS / Python / C# |

Raw OpenAPI YAML: [erp-api-openapi.yaml](./erp-api-openapi.yaml).

Guides:

| URL | Audience |
|---|---|
| [developer.messpunkt.io/erp/](https://developer.messpunkt.io/erp/) | ERP developers: registration, consent, tokens, refresh, revocation, errors |
| [developer.messpunkt.io/connect/](https://developer.messpunkt.io/connect/) | Landlords (German): connect Claude, ChatGPT or Codex |
| [developer.messpunkt.io/mcp/](https://developer.messpunkt.io/mcp/) | MCP client authors: transport, auth, tool reference |

The MCP tool reference is generated from the server's `tools/list` snapshot (`mcp/tools-list.json`): `node scripts/render-tools.mjs`. `node scripts/check-guides.mjs` checks every URL, route, scope and tool name in the guides against the spec and the snapshot. `node scripts/check-links.mjs` checks the relative links of every page. CI (`.github/workflows/checks.yml`) runs both plus `npx @redocly/cli lint erp-api-openapi.yaml` on every pull request.

## Status

| | |
|---|---|
| **Release** | GA ships with the first pilot partner and is announced in the [changelog](./changelog/) |
| **Current version** | `1.0.0-rc.3` · September 2026 |
| **Status** | Preview — release candidate for pilot-partner review; sandbox live, production in preparation |
| **Source of truth** | Mirrored from an internal engineering repository |

## Become a pilot partner

messpunkt.io is actively onboarding pilot ERP partners. If you operate a property-management or billing ERP and want to integrate:

- **Email:** [kontakt@messpunkt.io](mailto:kontakt@messpunkt.io?subject=Partner%20API%20-%20Pilot%20Integration)
- **What we'll send back:** sandbox credentials, OAuth app registration, a dedicated integration contact, pilot-phase feedback loop
- **What we'd love from you:** review of the current spec, a list of endpoints that are missing for your use case, your preferred response shape for edge cases (meter replacement, data gaps, tenant moves)

## Design highlights

- **OAuth 2.1 + PKCE, DPoP optional** — no static API keys. Authorization Code flow with mandatory PKCE (S256); sender-constrained tokens per [RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449) when the client sends a DPoP proof.
- **Per-Property authorization scope** — each token carries an explicit Property whitelist; out-of-scope resources return `404 Not Found` (not `403`) so no information about other Properties leaks.
- **Explicit meter-replacement semantics** — responses are nested per-MeasuringPoint with `DeviceSegment[]`; ERPs never have to diff serials to detect a swap.
- **Monthly, never finer** — month-end readings plus the billable consumption per device segment, computed like the landlord portal. No daily or per-telegram series: that would be a behavioural profile of residents.
- **Honest statuses** — `measured`, `calculated` (interpolated, `is_synthetic`), `substituted`, `missing`, `calibration_expired`; K-factor and start values per segment, so a mid-year meter swap bills correctly.
- **RFC 7807** problem-details for errors, ISO 8601 UTC for timestamps, cursor-based pagination, rate limiting with `Retry-After`.

## AI-ready

Discovery artifacts so the API is usable by AI assistants and LLM-based agents out of the box:

- **[llms.txt](https://developer.messpunkt.io/llms.txt)** — [llms.txt-standard](https://llmstxt.org) index for AI crawlers
- **[.well-known/ai-plugin.json](https://developer.messpunkt.io/.well-known/ai-plugin.json)** — plugin-style manifest (OAuth config + OpenAPI pointer)
- **OpenAPI 3.1 → tool schemas** — operations convert 1:1 to Anthropic Tool Use, OpenAI Function Calling, and Google Gemini / Vertex AI Function Calling

Full detail and constraints for agent authors are in the [*For AI agents*](https://developer.messpunkt.io/#section/For-AI-agents) section of the rendered docs.

**MCP server:** `https://mcp.messpunkt.io/v1` lets landlords ask their own AI assistant (Claude, ChatGPT, Codex) about their data — read-only tools, same consent and data rules as the REST API. Live since 2026-09-30; access is enabled per customer organisation. The production REST API goes live with the first pilot partner.

## Legal

- [Impressum](https://messpunkt.io/impressum)
- [Datenschutz](https://messpunkt.io/datenschutz)

No production credentials, endpoints or customer data are contained in this repository — it holds the public specification and the hosted documentation only.

---

*© 2026 messpunkt.io — Questions? [kontakt@messpunkt.io](mailto:kontakt@messpunkt.io)*
