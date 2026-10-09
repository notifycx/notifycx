# notifycx-mcp

Official [Model Context Protocol](https://modelcontextprotocol.io) server for [Notify](https://notify.cx).

Use this in Cursor, Claude Code, or other MCP hosts when a coding agent should call Notify tools directly. For app/CI code, prefer the [`notifycx`](https://www.npmjs.com/package/notifycx) SDK or plain `fetch`.

## Install (Cursor)

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

Get your API key from [Credentials](https://notify.cx/dashboard/credentials). Docs: [notify.cx/mcp](https://notify.cx/mcp).

## Tools

| Tool | When to use |
|------|-------------|
| `send_email` | Production transactional send (verified `from`) |
| `send_test_email` | Non-delivering API rehearsal |
| `add_domain` | Add domain + get DNS records (SPF/DKIM) |
| `check_domain` | Poll verification after DNS is configured |
| `list_domains` / `get_domain` | Domain / SPF / DKIM status |
| `list_webhooks` / `create_webhook` / `update_webhook` / `delete_webhook` / `get_webhook` / `test_webhook` | Webhook setup (Pro+) |
| `list_email_logs` | Recent delivery logs |
| `get_usage` | Quota / account_verified |
| `list_api_keys` | Key metadata (prefix only — create keys in the dashboard) |

Typical setup path: `add_domain` → add DNS → `check_domain` → `send_email`. Optional: `create_webhook` after a verified domain.

## Pricing

Free: 1,000 emails/mo. Pro: **$10 / 10,000**. Scale: $50 / 100,000.
