import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import Notify, { NotifyError } from 'notifycx';
import { z } from 'zod';

function requireApiKey(): string {
  const apiKey = process.env.NOTIFY_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing NOTIFY_API_KEY. Set it in your MCP server env (dashboard → Credentials).'
    );
  }
  return apiKey;
}

function client(): Notify {
  return new Notify({
    apiKey: requireApiKey(),
    baseUrl: process.env.NOTIFY_BASE_URL,
    client: 'mcp'
  });
}

function formatError(err: unknown): string {
  if (err instanceof NotifyError) {
    return JSON.stringify(
      {
        error: err.message,
        status: err.status,
        body: err.body,
        hint:
          err.status === 401
            ? 'Check NOTIFY_API_KEY in MCP config'
            : err.message.toLowerCase().includes('domain') ||
                err.message.toLowerCase().includes('sandbox')
              ? 'Verify a domain (SPF/DKIM) or use send_test_email until production is unlocked'
              : undefined
      },
      null,
      2
    );
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function ok(result: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
  };
}

function fail(err: unknown) {
  return {
    content: [{ type: 'text' as const, text: formatError(err) }],
    isError: true
  };
}

const eventTypeEnum = z.enum([
  'Bounce',
  'Click',
  'Complaint',
  'Delivery',
  'DeliveryDelay',
  'Open',
  'Send'
]);

const sendShape = {
  to: z.string().email().describe('Recipient email address'),
  from: z
    .string()
    .min(1)
    .describe(
      'Sender address or Name <email@verified-domain.com>. Production custom from requires a verified domain.'
    ),
  subject: z.string().min(1).describe('Email subject line'),
  html: z
    .string()
    .min(1)
    .optional()
    .describe('HTML (or plain text) body. Prefer html; message/text also work.'),
  message: z.string().min(1).optional().describe('Alias for html/body content'),
  text: z.string().min(1).optional().describe('Alias for html/body content')
};

const webhookWriteShape = {
  webhookUrl: z.string().url().describe('HTTPS URL to receive webhook events'),
  subscribedEvents: z
    .array(eventTypeEnum)
    .min(1)
    .describe('Event types to subscribe to'),
  domainId: z
    .string()
    .uuid()
    .describe('Verified sending domain id from list_domains'),
  matchMode: z
    .enum(['domain', 'hosts', 'froms'])
    .optional()
    .describe('Optional match scope (default domain)'),
  matchHosts: z
    .array(z.string())
    .max(20)
    .optional()
    .describe('When matchMode is hosts'),
  matchFroms: z
    .array(z.string())
    .max(20)
    .optional()
    .describe('When matchMode is froms')
};

const server = new McpServer({
  name: 'notifycx-mcp',
  version: '1.1.0'
});

server.tool(
  'send_email',
  'Send transactional email via Notify (password reset, receipt, magic link, invoice, etc.) with a verified from domain. Use when the user wants production delivery. Prefer html for the body. For non-delivering API rehearsal before domain verification, use send_test_email instead.',
  sendShape,
  async (args) => {
    try {
      return ok(await client().send(args));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'send_test_email',
  'API rehearsal for Notify: same request shape as production send but does not deliver and does not count toward quota. Use before domain verification or when testing the HTTP contract. For real inbox delivery, use send_email after verifying SPF/DKIM.',
  sendShape,
  async (args) => {
    try {
      return ok(await client().sendTest(args));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'list_domains',
  'List Notify sending domains and verification status (SPF/DKIM). Use when wiring a production from address or debugging domain auth. Includes DNS tokens when present.',
  {},
  async () => {
    try {
      return ok(await client().listDomains());
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'get_domain',
  'Get one Notify sending domain by hostname, including DNS records/tokens for pending verification.',
  {
    domain: z.string().min(1).describe('Domain hostname, e.g. example.com')
  },
  async (args) => {
    try {
      return ok(await client().getDomain(args.domain));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'add_domain',
  'Add a sending domain and start SPF/DKIM verification. Returns DNS records the user must add. After DNS is configured, call check_domain. Then use send_email with a from address on that domain.',
  {
    domain: z.string().min(1).describe('Domain hostname to verify, e.g. example.com'),
    dnsProvider: z
      .enum([
        'vercel',
        'cloudflare',
        'squarespace',
        'namecheap',
        'godaddy',
        'route53',
        'other'
      ])
      .optional()
      .describe('Optional DNS provider hint for dashboard UX')
  },
  async (args) => {
    try {
      return ok(await client().addDomain(args));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'check_domain',
  'Poll SES for domain SPF/DKIM verification status after DNS records were added. Call after add_domain. When both succeed, production send_email with that from domain is unlocked.',
  {
    domain: z.string().min(1).describe('Domain hostname to check')
  },
  async (args) => {
    try {
      return ok(await client().checkDomain(args.domain));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'list_email_logs',
  'List recent Notify email delivery logs. Use after a send to check delivery, bounce, open, or click status.',
  {
    page: z.number().int().positive().optional().describe('Page number (default 1)'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Page size (default 20, max 100)'),
    eventType: eventTypeEnum
      .optional()
      .describe('Filter logs by analytics event type')
  },
  async (args) => {
    try {
      return ok(await client().listLogs(args));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'get_usage',
  'Get Notify plan usage and quota (hourly/monthly sends, account_verified). Use when debugging limits or confirming production unlock.',
  {},
  async () => {
    try {
      return ok(await client().getUsage());
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'list_api_keys',
  'List API key metadata for the account (id, name, prefix only — never the full secret). Create or rotate keys in the Notify dashboard Credentials page.',
  {},
  async () => {
    try {
      return ok(await client().listApiKeys());
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'list_webhooks',
  'List Notify webhook subscriptions (URL, events, domain scope).',
  {},
  async () => {
    try {
      return ok(await client().listWebhooks());
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'get_webhook',
  'Get one Notify webhook by id.',
  {
    id: z.string().uuid().describe('Webhook subscription id')
  },
  async (args) => {
    try {
      return ok(await client().getWebhook(args.id));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'create_webhook',
  'Create a Notify webhook for delivery events on a verified domain. Requires Pro or Scale (free plan has 0 webhooks). Use list_domains to get domainId.',
  webhookWriteShape,
  async (args) => {
    try {
      return ok(await client().createWebhook(args));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'update_webhook',
  'Update an existing Notify webhook (URL, events, domain scope).',
  {
    id: z.string().uuid().describe('Webhook subscription id'),
    webhookUrl: webhookWriteShape.webhookUrl.optional(),
    subscribedEvents: webhookWriteShape.subscribedEvents.optional(),
    domainId: webhookWriteShape.domainId.optional(),
    matchMode: webhookWriteShape.matchMode,
    matchHosts: webhookWriteShape.matchHosts,
    matchFroms: webhookWriteShape.matchFroms
  },
  async (args) => {
    try {
      const { id, ...input } = args;
      return ok(await client().updateWebhook(id, input));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'delete_webhook',
  'Delete a Notify webhook subscription by id.',
  {
    id: z.string().uuid().describe('Webhook subscription id')
  },
  async (args) => {
    try {
      return ok(await client().deleteWebhook(args.id));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'test_webhook',
  'Send a test Notify webhook payload to a URL (does not require an existing subscription id).',
  {
    webhookUrl: z.string().url().describe('HTTPS URL to receive the test payload'),
    eventType: eventTypeEnum.describe('Event type for the test payload'),
    domainId: z
      .string()
      .uuid()
      .optional()
      .describe('Optional verified domain id for scoped test payloads')
  },
  async (args) => {
    try {
      return ok(await client().testWebhook(args));
    } catch (err) {
      return fail(err);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
