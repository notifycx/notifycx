# notifycx

Official Node/TypeScript client for [Notify](https://notify.cx) — transactional email for apps that already render HTML.

**Pro is $10 for 10,000 emails.** Domain auth (SPF/DKIM/DMARC), logs, and webhooks included. For IDE agents, see [`notifycx-mcp`](https://www.npmjs.com/package/notifycx-mcp).

## Install

```bash
npm install notifycx
```

## Send

```ts
import Notify from 'notifycx'

const notify = new Notify({ apiKey: process.env.NOTIFY_API_KEY! })
// or: new Notify(process.env.NOTIFY_API_KEY!)

await notify.send({
  to: 'user@example.com',
  from: 'Acme <hello@yourdomain.com>',
  subject: 'Reset your password',
  html: '<p>Click to reset…</p>',
})
```

`html`, `message`, and `text` are accepted (first non-empty wins). Production `from` requires a [verified domain](https://notify.cx/docs/domain-verification).

### Sandbox

```ts
await notify.sendTest({
  to: 'you@example.com',
  from: 'hello@yourdomain.com',
  subject: 'API rehearsal',
  html: '<p>Does not deliver</p>',
})
```

### Next.js App Router

```ts
// app/api/email/route.ts
import Notify from 'notifycx'
import { NextResponse } from 'next/server'

const notify = new Notify({ apiKey: process.env.NOTIFY_API_KEY! })

export async function POST(req: Request) {
  const { to, subject, html } = await req.json()
  const result = await notify.send({
    to,
    from: 'Acme <hello@yourdomain.com>',
    subject,
    html,
  })
  return NextResponse.json(result)
}
```

## Domains, webhooks, usage

```ts
await notify.addDomain({ domain: 'yourdomain.com' })
await notify.checkDomain('yourdomain.com')
await notify.listDomains()
await notify.getDomain('yourdomain.com')

await notify.createWebhook({
  webhookUrl: 'https://example.com/hooks/notify',
  subscribedEvents: ['Delivery', 'Bounce'],
  domainId: '…', // verified domain id from listDomains
})
await notify.listWebhooks()
await notify.testWebhook({
  webhookUrl: 'https://example.com/hooks/notify',
  eventType: 'Delivery',
})

await notify.getUsage()
await notify.listApiKeys() // metadata / prefix only — never the full secret
```

## Errors

Failed requests throw `NotifyError` with `status` and `body` so agents and apps can fix the issue (missing key, unverified domain, sandbox lock).

## Breaking changes in 1.0

- Calls `POST /api/email/send` (current API), not legacy template endpoints
- Requires `from`; drops required `name` and template methods
- Prefer `html` in examples; `message` / `text` still work

Plain `fetch` still works — this package is optional convenience for Node/TypeScript.

## Links

- [Docs](https://notify.cx/docs/how-to-use-notify-sdk)
- [Quick start](https://notify.cx/docs/quick-start-guide)
- [MCP for coding agents](https://notify.cx/mcp)
- [Pricing](https://notify.cx/pricing)
