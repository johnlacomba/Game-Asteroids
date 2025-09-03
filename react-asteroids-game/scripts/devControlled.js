#!/usr/bin/env node
// Dev script: start CRA front-end immediately; defer server start until triggered via HTTP endpoint

const { spawn } = require('child_process');
const path = require('path');
const express = require('express');

// Launch React dev server (detached to allow group signal kill)
const react = spawn('npm', ['start'], { stdio: 'inherit', shell: true, detached: true });

function killReactTree() {
  if (!react || react.killed) return;
  try {
    // Send SIGINT to entire group
    process.kill(-react.pid, 'SIGINT');
  } catch(_) {}
  // Hard kill fallback after grace period
  setTimeout(() => { try { process.kill(-react.pid, 'SIGKILL'); } catch(_) {} }, 3000);
}

let serverProcess = null;

function startServer() {
  if (serverProcess) return { started: false, message: 'Server already running' };
  serverProcess = spawn('node', ['src/server/server.js'], { stdio: 'inherit', shell: true });
  serverProcess.on('exit', code => {
    console.log('[backend] exited', code);
    serverProcess = null;
    // If backend indicates host-triggered shutdown (code 99), also stop React
    if (code === 99 || code === 0) {
      console.log('[control] Backend exited (code', code, '). Terminating React dev server (group).');
      killReactTree();
      setTimeout(()=>process.exit(0),500);
    }
  });
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

// Graceful full-stack shutdown endpoint (used when closing tab from title screen)
controlApp.post('/shutdown', (req,res) => {
  console.log('[control] Shutdown requested via /shutdown');
  if (serverProcess) {
    try { serverProcess.kill('SIGINT'); } catch(_) {}
  }
  killReactTree();
  res.json({ shuttingDown: true });
  setTimeout(()=>process.exit(0),400);
});

process.on('SIGINT', () => {
  if (serverProcess) serverProcess.kill('SIGINT');
  react.kill('SIGINT');
  process.exit();
});
