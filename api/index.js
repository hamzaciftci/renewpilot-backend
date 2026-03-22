// Static require — lets esbuild bundle dist/serverless.js at build time.
// rootDir=src in tsconfig.build.json ensures dist/serverless.js (not dist/src/serverless.js).
const serverless = require('../dist/serverless');
module.exports = serverless.default;
