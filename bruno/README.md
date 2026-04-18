# messpunkt.io Partner API — Bruno collection

A ready-to-use [Bruno](https://www.usebruno.com/) collection for the
messpunkt.io Partner API sandbox. Clone, open in Bruno, click
**Get Access Token** in the Auth tab — done.

## Prerequisites

1. [Bruno](https://www.usebruno.com/) v2 or newer (free, open-source).
2. A browser logged in on your workstation — Bruno opens the sandbox
   consent screen in a browser popup for the OAuth flow.

## Usage

Download the collection zip from
[developer.messpunkt.io/bruno](https://developer.messpunkt.io/bruno/)
and unzip it anywhere. In Bruno: **Open Collection** → pick the unzipped folder.

**First request:**

1. Click the collection name → **Auth** tab → **Get Access Token**.
   A browser opens, the sandbox consent screen shows the demo landlord
   `Musterhausverwaltung GmbH`. Pick one or more Properties → **Approve**.
2. Send `Whoami` — you should see the tenant name + granted scopes.
3. Drill into any `List Properties` / `List Usage Units` / `Get Consumption …`
   request.

## What's in here

| # | Request | Endpoint |
|---|---|---|
| 1 | Whoami | `GET /v1/whoami` |
| 2 | List Properties | `GET /v1/properties` |
| 3 | Get Property | `GET /v1/properties/{id}` |
| 4 | Get Property (Out of Scope) | 404 demo |
| 5 | List Usage Units | `GET /v1/usage-units` |
| 6 | Get Usage Unit | `GET /v1/usage-units/{id}` |
| 7 | Get Consumption — Warm Water | meter-replacement scenario |
| 8 | Get Consumption — Cold Water | single-segment baseline |
| 9 | Get Consumption — Heat | kWh, VDI-2067 substitution |
| 10 | Get Consumption — HCA (Data-Gap) | `data_gap: true` scenario |
| 11 | Get Measuring Point | `GET /v1/measuring-points/{id}` |
| 12 | Get Measuring Point Readings | `GET /v1/measuring-points/{id}/readings` |

Each request has its own `docs {}` block with the expected response shape
and a hint for what to try next.

## Hosts

- Authorization server: `https://auth.sandbox.messpunkt.io`
- Resource server:      `https://api.sandbox.messpunkt.io`

## Scopes

All three read scopes are requested by the collection by default:

- `read:units` — UsageUnits, Addresses, structural metadata
- `read:devices` — MeasuringPoints, Device lifecycle
- `read:readings` — MeterReadings, consumption details

## Troubleshooting

- **`invalid_redirect_uri`** on the consent screen → Bruno's default
  callback `http://localhost:3000/callback` is already on the sandbox
  allow-list. If you customised Bruno's callback, contact us to whitelist it.
- **`401` on data endpoints** → token expired (1 h lifetime). Click
  **Get Access Token** again.

## Support

`kontakt@messpunkt.io` · [OpenAPI spec](https://developer.messpunkt.io/erp-api-openapi.yaml)
· [Reference docs](https://developer.messpunkt.io/)
