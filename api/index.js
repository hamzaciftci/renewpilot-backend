// Plain JS entry — avoids TypeScript compilation issues with pre-built dist/
// @vercel/node bundles this at deploy time; dist/ is built by vercel-build (nest build)
const serverless = require('../dist/serverless');
module.exports = serverless.default;
