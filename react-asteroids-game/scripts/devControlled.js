#!/usr/bin/env node
// Dev script: start CRA front-end immediately; defer server start until triggered via HTTP endpoint

const { spawn } = require('child_process');
const path = require('path');
const express = require('express');

// Launch React dev server
const react = spawn('npm', ['start'], { stdio: 'inherit', shell: true });

let serverProcess = null;

function startServer() {
  if (serverProcess) return { started: false, message: 'Server already running' };
  serverProcess = spawn('node', ['src/server/server.js'], { stdio: 'inherit', shell: true });
  serverProcess.on('exit', code => { console.log('[backend] exited', code); serverProcess = null; });
  return { started: true, message: 'Server starting' };
}

// Lightweight control API on a different port to avoid collision with CRA (runs on 5002)
const controlApp = express();
controlApp.use(express.json());

controlApp.post('/start-backend', (req, res) => {
  const result = startServer();
  res.json(result);
});

controlApp.get('/status', (req, res) => {
  res.json({ running: !!serverProcess });
});

const CONTROL_PORT = 5002;
controlApp.listen(CONTROL_PORT, () => {
  console.log(`[control] Ready on http://localhost:${CONTROL_PORT} (POST /start-backend)`);
});

process.on('SIGINT', () => {
  if (serverProcess) serverProcess.kill('SIGINT');
  react.kill('SIGINT');
  process.exit();
});
