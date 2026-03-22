// Dynamic require — prevents esbuild from statically bundling dist/
// dist/ files are shipped raw via vercel.json includeFiles and loaded at runtime
const path = require('path');
const distPath = path.join(__dirname, '..', 'dist', 'serverless');
// eslint-disable-next-line import/no-dynamic-require
const serverless = require(distPath);
module.exports = serverless.default;
