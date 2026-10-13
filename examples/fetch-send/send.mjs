/**
 * Minimal native fetch send to Notify.
 * Requires Node 18+.
 *
 * Usage:
 *   cp .env.example .env   # set NOTIFY_API_KEY
 *   node --env-file=.env send.mjs
 *
 * Prefer sandbox until a domain is verified:
 *   NOTIFY_SANDBOX=1 node --env-file=.env send.mjs
 */

const apiKey = process.env.NOTIFY_API_KEY;
if (!apiKey) {
  console.error('Missing NOTIFY_API_KEY. Copy .env.example → .env');
  process.exit(1);
}

const sandbox = process.env.NOTIFY_SANDBOX === '1';
const path = sandbox ? '/api/email/send/test' : '/api/email/send';
const url = `https://notify.cx${path}`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  },
  body: JSON.stringify({
    to: process.env.NOTIFY_TO || 'user@example.com',
    from: process.env.NOTIFY_FROM || 'noreply@your-verified-domain.com',
    subject: sandbox ? 'Sandbox rehearsal' : 'Hello from fetch',
    html: '<p>Sent with native <code>fetch</code>.</p>',
  }),
});

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

if (!res.ok) {
  console.error('Send failed', res.status, body);
  process.exit(1);
}

console.log(sandbox ? 'Sandbox OK (not delivered):' : 'Sent:', body);
