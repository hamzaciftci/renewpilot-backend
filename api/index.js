// Vercel serverless handler for NestJS
// reflect-metadata must be first — required for NestJS DI decorator metadata
require('reflect-metadata');

// Static require so esbuild bundles dist/serverless into this function
const serverless = require('../dist/serverless');
const handler = serverless.default;

module.exports = async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error('[api/index] Unhandled handler error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Internal server error',
        detail: String(err),
      }));
    }
  }
};
