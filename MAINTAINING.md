# Maintaining notifycx

## Sources of truth

| Fact | Canonical location |
|------|--------------------|
| API behaviour / contracts | notify.cx runtime + https://notify.cx/openapi.yaml |
| Positioning, pricing, lexicon | https://notify.cx + Notify `AGENTS.md` / knowledge docs |
| This SDK + MCP code | This repository |
| Runnable framework kits | https://github.com/email-examples/transactional-email-examples |
| Coding-agent skill | https://github.com/email-agents/notify |

Do **not** fork the full notify.cx MDX docs tree into this repo. Link out.

## When the API changes

1. Update the product site / OpenAPI on notify.cx first.
2. Refresh `openapi/openapi.yaml` from the live spec.
3. Update `src/` + tests; run `npm test && npm run build`.
4. Smoke `examples/fetch-send` (mocked tests always; live only with a personal key).
5. Publish npm packages per `PUBLISH.md` (keep `notifycx` and `notifycx-mcp` versions aligned).
6. If paths or auth change, update the email-agents skill links.

## Security

- Never commit real API keys, AWS credentials, or `.env` files with values.
- This client must remain free of SES/AWS wiring — that stays private on Notify’s servers.
- Rotate any key that is ever committed; scrub history before public transfer if needed.

## Releases

See `PUBLISH.md`.
