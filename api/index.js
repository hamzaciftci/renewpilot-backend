// Vercel serverless handler for NestJS
// reflect-metadata must be first — required for NestJS DI decorator metadata
require('reflect-metadata');

let handler;
let initError;

try {
  const serverless = require('../dist/serverless');
  handler = serverless.default;
} catch (e) {
  initError = e;
  console.error('[api/index] Failed to load dist/serverless:', e.message);
}

module.exports = async (req, res) => {
  if (initError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Module load failed',
      message: initError.message,
      stack: initError.stack ? initError.stack.split('\n').slice(0, 8).join('\n') : ''
    }));
    return;
  }
  return handler(req, res);
};
