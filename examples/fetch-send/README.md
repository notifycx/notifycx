# Native `fetch` send

Minimal Node 18+ example — no SDK required.

## Setup

```bash
cp .env.example .env
# paste NOTIFY_API_KEY from https://notify.cx/dashboard/credentials
```

## Sandbox rehearsal (no delivery)

```bash
NOTIFY_SANDBOX=1 node --env-file=.env send.mjs
```

## Production send

Requires a [verified domain](https://notify.cx/docs/domain-verification) for custom `from`.

```bash
node --env-file=.env send.mjs
```

## Security

- Keep `NOTIFY_API_KEY` on the server only.
- This script is for local/CLI use; do not embed keys in browsers.

## Docs

- https://notify.cx/docs/quick-start-guide
- https://notify.cx/openapi.yaml
