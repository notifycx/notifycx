# Contributing

Thanks for helping improve the Notify client.

## Rules

- No real credentials in PRs (use `.env.example` placeholders only).
- Prefer small, focused changes.
- Keep the package a **client** — do not add Notify server / SES code.
- Do not invent undocumented API endpoints.

## Setup

```bash
npm install
npm test
npm run build
cd examples/fetch-send && node --test send.test.mjs
```

## Tests

- Unit tests mock `fetch` — they do not send live email.
- Live integration against notify.cx is optional and requires **your** `NOTIFY_API_KEY`. Never claim a live send succeeded without running it.
