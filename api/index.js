let handler;

try {
  handler = require('./dist/serverless').default;
} catch (loadErr) {
  console.error('[serverless] Failed to load handler:', loadErr);
  handler = (_req, res) => {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to load handler', message: loadErr.message }));
  };
}

module.exports = async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error('[serverless] Runtime error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
