const https = require('https');
const url = require('url');

function sendSlack(webhookUrl, message) {
  try {
    if (!webhookUrl || !message) return;
    const parsed = url.parse(webhookUrl);
    const payload = JSON.stringify({ text: message });
    const options = {
      method: 'POST',
      hostname: parsed.hostname,
      path: parsed.path,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, () => {});
    req.on('error', () => {});
    req.write(payload);
    req.end();
  } catch (_) {}
}

module.exports = { sendSlack };


