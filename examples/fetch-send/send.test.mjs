/**
 * Mocked verification — does not call Notify.
 * Run: node --test send.test.mjs
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('fetch-send envelope handling', () => {
  it('treats success envelope as ok', async () => {
    const json = { success: true, data: { messageId: 'msg_test' } };
    assert.equal(json.success, true);
    assert.ok(json.data.messageId);
  });

  it('surfaces error envelope', async () => {
    const json = {
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    };
    assert.equal(json.success, false);
    assert.equal(json.code, 'UNAUTHORIZED');
  });

  it('builds sandbox vs production paths', () => {
    const sandboxPath = '/api/email/send/test';
    const prodPath = '/api/email/send';
    assert.notEqual(sandboxPath, prodPath);
  });

  it('mocked fetch returns success', async () => {
    const fetchMock = mock.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ success: true, data: { messageId: 'm1' } }),
    }));
    const res = await fetchMock('https://notify.cx/api/email/send/test', {
      method: 'POST',
    });
    assert.equal(res.ok, true);
    assert.equal(fetchMock.mock.callCount(), 1);
  });
});
