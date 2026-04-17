# messpunkt.io Partner API — Documentation

![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-1e534a?style=flat-square)
![OAuth](https://img.shields.io/badge/OAuth-2.1%20%2B%20PKCE-1e534a?style=flat-square)
![DPoP](https://img.shields.io/badge/DPoP-RFC%209449-1e534a?style=flat-square)
![AI-ready](https://img.shields.io/badge/AI--ready-tool%20schemas%20%2B%20llms.txt-1e534a?style=flat-square)
![Status](https://img.shields.io/badge/status-preview-f2c94c?style=flat-square)
![Target](https://img.shields.io/badge/V1%20target-Q2%202026-2d9cdb?style=flat-square)

**Partner-facing API documentation for [messpunkt.io](https://messpunkt.io)** — the metering platform for German real estate. This repo hosts the OpenAPI 3.1 specification and the rendered documentation at **https://developer.messpunkt.io**.

## Why this matters

Property-management ERPs (Immobilienverwaltungs-Software) traditionally pull consumption data via legacy file exchanges or bespoke connectors. messpunkt.io exposes a **single, partner-agnostic REST/OAuth 2.1 API** that lets ERPs:

- List Liegenschaften (Properties) and Wohneinheiten (UsageUnits) under a landlord's Tenant
- Query meter readings (Ablesungen) with explicit meter-replacement semantics, estimated-vs-measured flags, and OBIS-coded metrics
- Connect via user-delegated OAuth (PKCE + DPoP) — no API keys on clipboards
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

## Status

| | |
|---|---|
| **Release target** | **Q2 2026** |
| **Current draft** | 0.1 · April 2026 |
| **Status** | Preview — specification frozen for pilot-partner review; implementation in progress |
| **Source of truth** | Mirrored from an internal engineering repository |

## Become a pilot partner

messpunkt.io is actively onboarding pilot ERP partners for Q2 2026. If you operate a property-management or billing ERP and want to integrate:

- **Email:** [kontakt@messpunkt.io](mailto:kontakt@messpunkt.io?subject=Partner%20API%20-%20Pilot%20Integration)
- **What we'll send back:** sandbox credentials, OAuth app registration, a dedicated integration contact, pilot-phase feedback loop
- **What we'd love from you:** review of the current spec, a list of endpoints that are missing for your use case, your preferred response shape for edge cases (meter replacement, data gaps, tenant moves)

## Design highlights

- **OAuth 2.1 + PKCE + DPoP** — sender-constrained tokens, no static API keys. Authorization Code flow with mandatory PKCE (S256) and DPoP-bound access tokens per [RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449).
- **Per-Property authorization scope** — each token carries an explicit Property whitelist; out-of-scope resources return `404 Not Found` (not `403`) so no information about other Properties leaks.
- **Explicit meter-replacement semantics** — responses are nested per-MeasuringPoint with `DeviceSegment[]`; ERPs never have to diff serials to detect a swap.
- **OBIS-aligned metrics** — every reading carries an [OBIS code](https://en.wikipedia.org/wiki/IEC_62056) per IEC 62056-6-1 so partners can unambiguously identify what a value represents.
- **Two readings per segment** — simple billing contract: start value + end value per device, clipped to the query range. Intermediate snapshots (charting) are a future `granularity=` extension.
- **RFC 7807** problem-details for errors, ISO 8601 UTC for timestamps, cursor-based pagination, per-client rate limiting.

## AI-ready

Discovery artifacts so the API is usable by AI assistants and LLM-based agents out of the box:

- **[llms.txt](https://developer.messpunkt.io/llms.txt)** — [llms.txt-standard](https://llmstxt.org) index for AI crawlers
- **[.well-known/ai-plugin.json](https://developer.messpunkt.io/.well-known/ai-plugin.json)** — plugin-style manifest (OAuth config + OpenAPI pointer)
- **OpenAPI 3.1 → tool schemas** — operations convert 1:1 to Anthropic Tool Use, OpenAI Function Calling, and Google Gemini / Vertex AI Function Calling

Full detail and constraints for agent authors are in the [*For AI agents*](https://developer.messpunkt.io/#section/For-AI-agents) section of the rendered docs.

**Roadmap:** Tier 2 is an **MCP server** (Model Context Protocol) for native Claude Desktop, Cursor, ChatGPT Desktop and IDE integrations — planned as a follow-up spike.

## Legal

- [Impressum](https://messpunkt.io/impressum)
- [Datenschutz](https://messpunkt.io/datenschutz)

No production credentials, endpoints or customer data are contained in this repository — it holds the public specification and the hosted documentation only.

---

*© 2026 messpunkt.io — Questions? [kontakt@messpunkt.io](mailto:kontakt@messpunkt.io)*
