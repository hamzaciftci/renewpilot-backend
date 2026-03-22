const path = require('path');
const fs = require('fs');

module.exports = (req, res) => {
  const results = {};

  // Check __dirname and dist path
  results.dirname = __dirname;
  results.distPath = path.join(__dirname, '..', 'dist');
  results.distExists = fs.existsSync(results.distPath);

  if (results.distExists) {
    try {
      results.distFiles = fs.readdirSync(results.distPath).slice(0, 20);
    } catch (e) {
      results.distReadError = e.message;
    }
  }

  // Try to require dist/serverless
  try {
    const serverlessPath = path.join(__dirname, '..', 'dist', 'serverless');
    results.serverlessPath = serverlessPath;
    results.serverlessExists = fs.existsSync(serverlessPath + '.js');
    const m = require(serverlessPath);
    results.serverlessLoaded = true;
    results.serverlessDefaultType = typeof m.default;
  } catch (e) {
    results.serverlessError = e.message;
    results.serverlessStack = e.stack ? e.stack.split('\n').slice(0, 5).join('\n') : '';
  }

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(results, null, 2));
};
