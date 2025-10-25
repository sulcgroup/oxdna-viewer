#!/usr/bin/env node
const express = require('express');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 9002;
const rootDir = process.env.ROOT_DIR || process.cwd();
const dashboardRoot = process.env.DASH_ROOT || path.join('dist', 'dash');

const app = express();

// Serve all static files from the project root (allow default index for '/').
app.use(express.static(rootDir));

// Explicitly serve repository root index.html for '/'
app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

// SPA fallback for the dashboard routes: any request under /dist/dash that
// doesn't resolve to a file should return dist/dash/index.html
// Use a regex route to avoid path-to-regexp treating '*' as a named param
app.get(/^\/dist\/dash(?:\/.*)?$/, (req, res, next) => {
  const reqPath = decodeURI(req.path);
  const filePath = path.join(rootDir, reqPath);

  // If the file exists and is not a directory, serve it directly
  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) return res.sendFile(filePath);
  } catch (e) {
    // file doesn't exist, fall through to serve index
  }

  // Serve the dashboard index.html for SPA routes
  return res.sendFile(path.join(rootDir, dashboardRoot, 'index.html'), (err) => {
    if (err) return next(err);
  });
});

app.listen(port, () => {
  console.log(`Serving ${rootDir} on http://0.0.0.0:${port}/ with SPA fallback for /dist/dash`);
});
