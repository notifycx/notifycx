# notifycx-mcp

Official [Model Context Protocol](https://modelcontextprotocol.io) server for [Notify](https://notify.cx).

Use this in Cursor, Claude Code, or other MCP hosts when a coding agent should call Notify tools directly. For app/CI code, prefer the [`notifycx`](https://www.npmjs.com/package/notifycx) SDK or plain `fetch`.

## Install (Cursor)

**Already have a key:**

```json
{
  "mcpServers": {
    "notify": {
      "command": "npx",
      "args": ["-y", "notifycx-mcp"],
      "env": {
        "NOTIFY_API_KEY": "nk_..."
      }
    }
  }
}
```

**No key yet:** omit `NOTIFY_API_KEY`, call `bootstrap_start` → user pastes email OTP → `bootstrap_confirm` → put the returned `api_key` into MCP env. See [agent bootstrap docs](https://notify.cx/docs/agent-bootstrap-no-dashboard).

Never paste API key secrets into chat logs.

## Tools

| Tool | When to use |
|------|-------------|
| `bootstrap_start` / `bootstrap_confirm` | Sign up or recover without the dashboard (no API key required) |
| `send_email` | Production transactional send (verified `from`) |
| `send_test_email` | Non-delivering API rehearsal |
| `add_domain` | Add domain + structured `dnsRecords` (type/name/value) for the user to publish at their host |
| `check_domain` | Poll verification after DNS is configured |
| `list_domains` / `get_domain` | Domain status + `dnsRecords` |
| `list_webhooks` / `create_webhook` / `update_webhook` / `delete_webhook` / `get_webhook` / `test_webhook` | Webhook setup (Pro+) |
| `list_email_logs` | Recent delivery logs |
| `get_usage` | Quota / account_verified |
| `list_api_keys` / `create_api_key` / `regenerate_api_key` / `delete_api_key` | Manage keys |
| `create_billing_checkout` | Stripe Checkout URL for Pro/Scale |

Typical setup path: bootstrap → `add_domain` → user publishes `dnsRecords` → `check_domain` → `send_email`.

## Pricing

Free: 1,000 emails/mo. Pro: **$10 / 10,000**. Scale: $50 / 100,000.
