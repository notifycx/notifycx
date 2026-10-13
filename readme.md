# notifycx

[![npm](https://img.shields.io/npm/v/notifycx.svg)](https://www.npmjs.com/package/notifycx)
[![CI](https://github.com/notifycx/notifycx/actions/workflows/ci.yml/badge.svg)](https://github.com/notifycx/notifycx/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-notify.cx-111.svg)](https://notify.cx/docs/how-to-use-notify-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Official Node/TypeScript client for [Notify](https://notify.cx) — a deliberately minimal **transactional email API**.

Notify sends email with one HTTPS request. You (or your AI) already render the HTML; Notify delivers it. Domain auth (SPF/DKIM/DMARC), logs, and webhooks included.

**Pro is $10 for 10,000 emails** · [Pricing](https://notify.cx/pricing)

## What this repo is

This repository is the **official client** (`notifycx`) and **official MCP** (`notifycx-mcp`). It talks to `https://notify.cx` over HTTPS.

It does **not** include Notify’s server, AWS SES credentials, or any way to use Notify’s infrastructure without **your own** API key from the [dashboard](https://notify.cx/dashboard/credentials). Forks cannot send on Notify’s AWS account.

## Three ways to send

| Context | Prefer |
|---------|--------|
| App / CI / production (Node/TS) | `npm i notifycx` (this package) |
| App / any language | Native `fetch` / curl — see [`examples/fetch-send`](./examples/fetch-send) |
| IDE coding agents | [`notifycx-mcp`](./mcp) — `npx -y notifycx-mcp` with `NOTIFY_API_KEY` |

## First email in minutes

1. Create an account at [notify.cx](https://notify.cx) and copy an API key.
2. Install and send (sandbox first if you have not verified a domain yet):

```bash
npm install notifycx
```

```ts
import Notify from 'notifycx'

const notify = new Notify({ apiKey: process.env.NOTIFY_API_KEY! })

// Non-delivering API rehearsal (no SES):
await notify.sendTest({
  to: 'you@example.com',
  from: 'hello@yourdomain.com',
  subject: 'API rehearsal',
  html: '<p>Does not deliver</p>',
})

// Production (requires verified domain for custom from):
await notify.send({
  to: 'user@example.com',
  from: 'Acme <hello@yourdomain.com>',
  subject: 'Reset your password',
  html: '<p>Click to reset…</p>',
})
```

Prefer `html` in new code. `message` and `text` are also accepted.

### Auth

- Header: `x-api-key` (the SDK sets this for you)
- Env: `NOTIFY_API_KEY` — never commit real keys; never put keys in client bundles
- Optional: `NOTIFY_BASE_URL` / `baseUrl` for local mocks only (default `https://notify.cx`)

### Responses

Success: `{ success: true, data: { messageId: "…" } }`  
Failure: `{ success: false, error: "…", code: "…" }` — the SDK throws `NotifyError` with `status` and `body`.

### Security

- Call Notify only from **server-side** code (Route Handlers, Workers, Actions, backends).
- Prefer domain-locked `sending_access` keys in apps; use `full_access` for MCP / dashboard management.
- No AWS keys belong in this client. SES runs on Notify’s servers after your authenticated API request.

## Native fetch (no SDK)

See [`examples/fetch-send`](./examples/fetch-send) or:

```js
const res = await fetch('https://notify.cx/api/email/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.NOTIFY_API_KEY,
  },
  body: JSON.stringify({
    to: 'user@example.com',
    from: 'noreply@your-verified-domain.com',
    subject: 'Hello',
    html: '<p>Sent with fetch.</p>',
  }),
})
```

## OpenAPI

- Vendored copy: [`openapi/openapi.yaml`](./openapi/openapi.yaml) (synced from Notify)
- Live: [https://notify.cx/openapi.yaml](https://notify.cx/openapi.yaml)
- Interactive: [https://notify.cx/api-docs](https://notify.cx/api-docs)

## MCP for coding agents

```bash
npx -y notifycx-mcp
```

Set `NOTIFY_API_KEY` in your MCP server env. Details: [mcp/README.md](./mcp/README.md) · [notify.cx/mcp](https://notify.cx/mcp)

## Links

- [SDK docs](https://notify.cx/docs/how-to-use-notify-sdk)
- [Quick start](https://notify.cx/docs/quick-start-guide)
- [Domain verification](https://notify.cx/docs/domain-verification)
- [Runnable examples](https://github.com/email-examples/transactional-email-examples)
- [Coding-agent skill](https://github.com/email-agents/notify)
- [Support](https://notify.cx/contact)

## Develop

```bash
npm test
npm run build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [MAINTAINING.md](./MAINTAINING.md).
