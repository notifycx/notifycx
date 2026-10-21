#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import Notify, { NotifyError } from 'notifycx';
import { z } from 'zod';

function baseUrl(): string | undefined {
  return process.env.NOTIFY_BASE_URL;
}

function optionalApiKey(): string | undefined {
  return process.env.NOTIFY_API_KEY;
}

function requireApiKey(): string {
  const apiKey = optionalApiKey();
  if (!apiKey) {
    throw new Error(
      'Missing NOTIFY_API_KEY. Run bootstrap_start + bootstrap_confirm first, then set NOTIFY_API_KEY in MCP env to the returned api_key (never paste secrets into chat).'
    );
  }
  return apiKey;
}

function client(): Notify {
  return new Notify({
    apiKey: requireApiKey(),
    baseUrl: baseUrl(),
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
  version: '1.2.0'
});

server.tool(
  'bootstrap_start',
  'Start Notify agent signup or key recovery without the dashboard. Sends a 6-digit email OTP. No NOTIFY_API_KEY required. Ask the user to paste the code, then call bootstrap_confirm. Requires acceptTerms: true (https://notify.cx/terms).',
  {
    email: z.string().email().describe('User email for the Notify account'),
    intent: z
      .enum(['signup', 'recover'])
      .optional()
      .describe('signup (default) or recover existing account'),
    acceptTerms: z
      .boolean()
      .describe('Must be true — user accepts Terms and AUP')
  },
  async (args) => {
    try {
      return ok(
        await Notify.bootstrapStart({
          email: args.email,
          intent: args.intent,
          acceptTerms: args.acceptTerms,
          baseUrl: baseUrl()
        })
      );
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'bootstrap_confirm',
  'Confirm the email OTP from bootstrap_start. Returns api_key once — instruct the user to put it in MCP env NOTIFY_API_KEY (do not leave the secret in chat). Then use add_domain / send_email. No NOTIFY_API_KEY required for this call.',
  {
    email: z.string().email(),
    code: z.string().regex(/^\d{6}$/).describe('6-digit code from email'),
    intent: z.enum(['signup', 'recover']).optional(),
    clientHint: z.string().max(64).optional().describe('e.g. cursor, chatgpt')
  },
  async (args) => {
    try {
      return ok(
        await Notify.bootstrapConfirm({
          email: args.email,
          code: args.code,
          intent: args.intent,
          clientHint: args.clientHint,
          baseUrl: baseUrl()
        })
      );
    } catch (err) {
      return fail(err);
    }
  }
);

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
  'List Notify sending domains and verification status (SPF/DKIM). Includes structured dnsRecords (type/name/value) for the user to publish at their DNS host.',
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
  'Get one Notify sending domain by hostname, including dnsRecords (type/name/value) and raw DNS tokens for pending verification. Show dnsRecords to the user so they can add them at their hosting provider.',
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
  'Add a sending domain and start SPF/DKIM verification. Returns dnsRecords (type/name/value) the user must add at their DNS host — Notify does not publish DNS. After DNS is configured, call check_domain. Then use send_email with a from address on that domain.',
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
      .describe('Optional DNS provider hint for host/name formatting')
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
  'Poll SES for domain SPF/DKIM verification status after DNS records were added. Call after add_domain. When both succeed, production send_email with that from domain is unlocked and the plan email limit lifts.',
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
  'List API key metadata for the account (id, name, prefix only — never the full secret).',
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
  'create_api_key',
  'Create an API key (full_access required). Free plan allows one key. Prefer sending_access + domainId for app keys on Pro+.',
  {
    name: z.string().min(1),
    permission: z.enum(['full_access', 'sending_access']).optional(),
    domainId: z.string().uuid().optional()
  },
  async (args) => {
    try {
      return ok(await client().createApiKey(args));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'regenerate_api_key',
  'Rotate an API key secret by keyId. Returns the new api_key once — update NOTIFY_API_KEY / app secrets.',
  {
    keyId: z.string().uuid()
  },
  async (args) => {
    try {
      return ok(await client().regenerateApiKey(args.keyId));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'delete_api_key',
  'Deactivate an API key by keyId. Cannot delete the last full_access key.',
  {
    keyId: z.string().uuid()
  },
  async (args) => {
    try {
      return ok(await client().deleteApiKey(args.keyId));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  'create_billing_checkout',
  'Get a Stripe Checkout URL for Pro or Scale (full_access key). User opens the URL in a browser to pay — not the Notify dashboard.',
  {
    plan: z.enum(['pro', 'scale']).optional()
  },
  async (args) => {
    try {
      return ok(await client().createBillingCheckout({ plan: args.plan }));
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
