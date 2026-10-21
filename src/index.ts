export type NotifyClientId = 'sdk' | 'mcp' | (string & {});

export type NotifyClientOptions = {
  /** Required for authenticated methods. Optional when only calling static bootstrap helpers. */
  apiKey?: string;
  /** Defaults to https://notify.cx */
  baseUrl?: string;
  /**
   * Identifies this client for Notify telemetry (`X-Notify-Client`).
   * Defaults to `sdk`. Pass `mcp` from notifycx-mcp.
   */
  client?: NotifyClientId;
};

export type BootstrapStartInput = {
  email: string;
  intent?: 'signup' | 'recover';
  acceptTerms: boolean;
  baseUrl?: string;
};

export type BootstrapConfirmInput = {
  email: string;
  code: string;
  intent?: 'signup' | 'recover';
  clientHint?: string;
  baseUrl?: string;
};

export type CreateApiKeyInput = {
  name: string;
  permission?: 'full_access' | 'sending_access';
  domainId?: string;
};

export type BillingCheckoutInput = {
  plan?: 'pro' | 'scale';
};

export type SendEmailInput = {
  to: string;
  from: string;
  subject: string;
  /** Preferred body field (HTML or plain text). Aliases: message, text. */
  html?: string;
  message?: string;
  text?: string;
};

export type SendEmailResult = {
  success: boolean;
  data?: {
    messageId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type AddDomainInput = {
  domain: string;
  dnsProvider?:
    | 'vercel'
    | 'cloudflare'
    | 'squarespace'
    | 'namecheap'
    | 'godaddy'
    | 'route53'
    | 'other';
};

export type CreateWebhookInput = {
  webhookUrl: string;
  subscribedEvents: Array<
    | 'Bounce'
    | 'Click'
    | 'Complaint'
    | 'Delivery'
    | 'DeliveryDelay'
    | 'Open'
    | 'Send'
  >;
  domainId: string;
  matchMode?: 'domain' | 'hosts' | 'froms';
  matchHosts?: string[];
  matchFroms?: string[];
};

export type UpdateWebhookInput = Partial<CreateWebhookInput>;

export type TestWebhookInput = {
  webhookUrl: string;
  eventType:
    | 'Bounce'
    | 'Click'
    | 'Complaint'
    | 'Delivery'
    | 'DeliveryDelay'
    | 'Open'
    | 'Send';
  domainId?: string;
};

export class NotifyError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'NotifyError';
    this.status = status;
    this.body = body;
  }
}

/** Keep in sync with package.json version (sent as X-Notify-Client-Version). */
export const NOTIFYCX_VERSION = '1.2.0';

async function publicJson(
  baseUrl: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  apiKey?: string
): Promise<unknown> {
  const headers: Record<string, string> = {
    'X-Notify-Client': 'sdk',
    'X-Notify-Client-Version': NOTIFYCX_VERSION,
    'User-Agent': `notifycx/${NOTIFYCX_VERSION}`
  };
  if (apiKey) headers['x-api-key'] = apiKey;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      responseBody &&
      typeof responseBody === 'object' &&
      'error' in responseBody &&
      typeof (responseBody as { error: unknown }).error === 'string'
        ? (responseBody as { error: string }).error
        : `Notify request failed (${response.status})`;
    throw new NotifyError(detail, response.status, responseBody);
  }

  return responseBody ?? { success: true };
}

function resolveBody(input: SendEmailInput): string {
  const body = [input.html, input.message, input.text].find(
    (value): value is string => typeof value === 'string' && value.length > 0
  );
  if (!body) {
    throw new Error(
      'Notify send requires one of html, message, or text (non-empty string)'
    );
  }
  return body;
}

function normalizeOptions(
  apiKeyOrOptions: string | NotifyClientOptions
): NotifyClientOptions {
  if (typeof apiKeyOrOptions === 'string') {
    return { apiKey: apiKeyOrOptions };
  }
  return apiKeyOrOptions;
}

export class Notify {
  private apiKey: string | undefined;
  private baseUrl: string;
  private client: string;

  constructor(apiKeyOrOptions: string | NotifyClientOptions) {
    const options = normalizeOptions(apiKeyOrOptions);
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://notify.cx').replace(/\/$/, '');
    this.client = options.client?.trim() || 'sdk';
  }

  private requireApiKey(): string {
    if (!this.apiKey) {
      throw new Error(
        'Notify requires an apiKey for this method. Use Notify.bootstrapStart / bootstrapConfirm first, then construct with the returned key.'
      );
    }
    return this.apiKey;
  }

  /** Start agent bootstrap (email OTP). No API key required. */
  static bootstrapStart(input: BootstrapStartInput): Promise<unknown> {
    const baseUrl = (input.baseUrl ?? 'https://notify.cx').replace(/\/$/, '');
    return publicJson(baseUrl, 'POST', '/api/agent/bootstrap/start', {
      email: input.email,
      intent: input.intent ?? 'signup',
      acceptTerms: input.acceptTerms
    });
  }

  /** Confirm agent bootstrap OTP and receive api_key once. No API key required. */
  static bootstrapConfirm(input: BootstrapConfirmInput): Promise<unknown> {
    const baseUrl = (input.baseUrl ?? 'https://notify.cx').replace(/\/$/, '');
    return publicJson(baseUrl, 'POST', '/api/agent/bootstrap/confirm', {
      email: input.email,
      code: input.code,
      intent: input.intent ?? 'signup',
      clientHint: input.clientHint
    });
  }

  private requestHeaders(
    extra?: Record<string, string>
  ): Record<string, string> {
    return {
      'x-api-key': this.requireApiKey(),
      'X-Notify-Client': this.client,
      'X-Notify-Client-Version': NOTIFYCX_VERSION,
      'User-Agent': `notifycx/${NOTIFYCX_VERSION}`,
      ...extra
    };
  }

  /** Production send → POST /api/email/send */
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    return this.request('/api/email/send', input);
  }

  /** Sandbox / API rehearsal → POST /api/email/send/test (non-delivering) */
  async sendTest(input: SendEmailInput): Promise<SendEmailResult> {
    return this.request('/api/email/send/test', input);
  }

  /** List verified/pending domains → GET /api/email/domains */
  async listDomains(): Promise<unknown> {
    return this.get('/api/email/domains');
  }

  /** Domain detail → GET /api/email/domains/:domain */
  async getDomain(domain: string): Promise<unknown> {
    return this.get(`/api/email/domains/${encodeURIComponent(domain)}`);
  }

  /** Add domain + start verification → POST /api/email/domains */
  async addDomain(input: AddDomainInput): Promise<unknown> {
    return this.json('POST', '/api/email/domains', input);
  }

  /** Poll SES verification → POST /api/email/domains/:domain/check */
  async checkDomain(domain: string): Promise<unknown> {
    return this.json(
      'POST',
      `/api/email/domains/${encodeURIComponent(domain)}/check`
    );
  }

  /** Recent delivery logs → GET /api/email/logs */
  async listLogs(query?: {
    page?: number;
    limit?: number;
    eventType?: string;
  }): Promise<unknown> {
    const params = new URLSearchParams();
    if (query?.page != null) params.set('page', String(query.page));
    if (query?.limit != null) params.set('limit', String(query.limit));
    if (query?.eventType) params.set('eventType', query.eventType);
    const qs = params.toString();
    return this.get(`/api/email/logs${qs ? `?${qs}` : ''}`);
  }

  /** Usage / quota → GET /api/email/usage */
  async getUsage(): Promise<unknown> {
    return this.get('/api/email/usage');
  }

  /** List API key metadata (prefix only) → GET /api/email/api-keys */
  async listApiKeys(): Promise<unknown> {
    return this.get('/api/email/api-keys');
  }

  /** Create API key → POST /api/email/api-keys (full_access) */
  async createApiKey(input: CreateApiKeyInput): Promise<unknown> {
    return this.json('POST', '/api/email/api-keys', input);
  }

  /** Regenerate API key → POST /api/email/api-keys/regenerate */
  async regenerateApiKey(keyId: string): Promise<unknown> {
    return this.json('POST', '/api/email/api-keys/regenerate', { keyId });
  }

  /** Delete API key → DELETE /api/email/api-keys */
  async deleteApiKey(keyId: string): Promise<unknown> {
    return this.json('DELETE', '/api/email/api-keys', { keyId });
  }

  /** Stripe Checkout URL → POST /api/email/billing/checkout */
  async createBillingCheckout(
    input: BillingCheckoutInput = {}
  ): Promise<unknown> {
    return this.json('POST', '/api/email/billing/checkout', {
      plan: input.plan ?? 'pro'
    });
  }

  /** List webhooks → GET /api/webhooks */
  async listWebhooks(): Promise<unknown> {
    return this.get('/api/webhooks');
  }

  /** Get webhook → GET /api/webhooks/:id */
  async getWebhook(id: string): Promise<unknown> {
    return this.get(`/api/webhooks/${encodeURIComponent(id)}`);
  }

  /** Create webhook → POST /api/webhooks */
  async createWebhook(input: CreateWebhookInput): Promise<unknown> {
    return this.json('POST', '/api/webhooks', input);
  }

  /** Update webhook → PUT /api/webhooks/:id */
  async updateWebhook(
    id: string,
    input: UpdateWebhookInput
  ): Promise<unknown> {
    return this.json('PUT', `/api/webhooks/${encodeURIComponent(id)}`, input);
  }

  /** Delete webhook → DELETE /api/webhooks/:id */
  async deleteWebhook(id: string): Promise<unknown> {
    return this.json('DELETE', `/api/webhooks/${encodeURIComponent(id)}`);
  }

  /** Test webhook delivery → POST /api/webhooks/test */
  async testWebhook(input: TestWebhookInput): Promise<unknown> {
    return this.json('POST', '/api/webhooks/test', input);
  }

  private async request(
    path: string,
    input: SendEmailInput
  ): Promise<SendEmailResult> {
    const message = resolveBody(input);
    return this.json('POST', path, {
      to: input.to,
      from: input.from,
      subject: input.subject,
      message
    }) as Promise<SendEmailResult>;
  }

  private async get(path: string): Promise<unknown> {
    return this.json('GET', path);
  }

  private async json(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.requestHeaders(
        body !== undefined ? { 'Content-Type': 'application/json' } : undefined
      ),
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      const detail =
        responseBody &&
        typeof responseBody === 'object' &&
        'error' in responseBody &&
        typeof (responseBody as { error: unknown }).error === 'string'
          ? (responseBody as { error: string }).error
          : `Notify request failed (${response.status})`;
      throw new NotifyError(detail, response.status, responseBody);
    }

    return responseBody ?? { success: true };
  }
}

export default Notify;
