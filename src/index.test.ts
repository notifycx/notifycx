import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { Notify, NotifyError } from './index';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restoreAll();
});

function mockFetch(status: number, body: unknown) {
  const fn = mock.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }));
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('Notify', () => {
  it('requires an apiKey', () => {
    assert.throws(() => new Notify(''), /Notify requires an apiKey/);
  });

  it('sends with html mapped to message', async () => {
    const fn = mockFetch(200, { success: true, data: { messageId: 'abc' } });
    const notify = new Notify({ apiKey: 'nk_test' });
    const result = await notify.send({
      to: 'user@example.com',
      from: 'Acme <hello@acme.com>',
      subject: 'Hi',
      html: '<p>Hello</p>'
    });

    assert.equal(result.data?.messageId, 'abc');
    assert.equal(fn.mock.calls.length, 1);
    const [url, init] = fn.mock.calls[0].arguments as [
      string,
      RequestInit
    ];
    assert.equal(url, 'https://notify.cx/api/email/send');
    assert.equal(
      init.body,
      JSON.stringify({
        to: 'user@example.com',
        from: 'Acme <hello@acme.com>',
        subject: 'Hi',
        message: '<p>Hello</p>'
      })
    );
  });

  it('sendTest hits the sandbox path', async () => {
    const fn = mockFetch(200, { success: true });
    const notify = new Notify('nk_test');
    await notify.sendTest({
      to: 'user@example.com',
      from: 'hello@acme.com',
      subject: 'Test',
      message: 'plain'
    });
    const [url] = fn.mock.calls[0].arguments as [string];
    assert.equal(url, 'https://notify.cx/api/email/send/test');
  });

  it('sends X-Notify-Client headers (default sdk)', async () => {
    const fn = mockFetch(200, { success: true });
    const notify = new Notify({ apiKey: 'nk_test' });
    await notify.send({
      to: 'user@example.com',
      from: 'hello@acme.com',
      subject: 'Hi',
      html: '<p>x</p>'
    });
    const [, init] = fn.mock.calls[0].arguments as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    assert.equal(headers['X-Notify-Client'], 'sdk');
    assert.equal(headers['X-Notify-Client-Version'], '1.1.0');
    assert.equal(headers['User-Agent'], 'notifycx/1.1.0');
  });

  it('allows client override for mcp', async () => {
    const fn = mockFetch(200, { success: true });
    const notify = new Notify({ apiKey: 'nk_test', client: 'mcp' });
    await notify.listDomains();
    const [, init] = fn.mock.calls[0].arguments as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    assert.equal(headers['X-Notify-Client'], 'mcp');
  });

  it('addDomain posts to /api/email/domains', async () => {
    const fn = mockFetch(200, {
      success: true,
      data: { domain: 'acme.com', verificationToken: 'tok' }
    });
    const notify = new Notify({ apiKey: 'nk_test' });
    await notify.addDomain({ domain: 'acme.com' });
    const [url, init] = fn.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, 'https://notify.cx/api/email/domains');
    assert.equal(init.method, 'POST');
    assert.equal(init.body, JSON.stringify({ domain: 'acme.com' }));
  });

  it('checkDomain posts to /check', async () => {
    const fn = mockFetch(200, { success: true });
    const notify = new Notify({ apiKey: 'nk_test' });
    await notify.checkDomain('acme.com');
    const [url, init] = fn.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, 'https://notify.cx/api/email/domains/acme.com/check');
    assert.equal(init.method, 'POST');
  });

  it('createWebhook posts to /api/webhooks', async () => {
    const fn = mockFetch(201, { success: true });
    const notify = new Notify({ apiKey: 'nk_test' });
    await notify.createWebhook({
      webhookUrl: 'https://example.com/hook',
      subscribedEvents: ['Delivery'],
      domainId: '11111111-1111-1111-1111-111111111111'
    });
    const [url, init] = fn.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, 'https://notify.cx/api/webhooks');
    assert.equal(init.method, 'POST');
  });

  it('getUsage hits /api/email/usage', async () => {
    const fn = mockFetch(200, { success: true });
    const notify = new Notify({ apiKey: 'nk_test' });
    await notify.getUsage();
    const [url] = fn.mock.calls[0].arguments as [string];
    assert.equal(url, 'https://notify.cx/api/email/usage');
  });

  it('throws NotifyError with actionable message', async () => {
    mockFetch(401, { error: 'Invalid API key', code: 'INVALID_API_KEY' });
    const notify = new Notify({ apiKey: 'bad' });
    await assert.rejects(
      () =>
        notify.send({
          to: 'a@b.com',
          from: 'c@d.com',
          subject: 'x',
          html: 'y'
        }),
      (err: unknown) => {
        assert.ok(err instanceof NotifyError);
        assert.equal(err.status, 401);
        assert.equal(err.message, 'Invalid API key');
        return true;
      }
    );
  });

  it('rejects missing body fields', async () => {
    const notify = new Notify({ apiKey: 'nk_test' });
    await assert.rejects(
      () =>
        notify.send({
          to: 'a@b.com',
          from: 'c@d.com',
          subject: 'x'
        }),
      /html, message, or text/
    );
  });
});
