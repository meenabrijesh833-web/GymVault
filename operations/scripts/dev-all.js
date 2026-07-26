const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

const rootDir = process.cwd();
const frontendDir = path.join(rootDir, 'frontend');

function checkPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(1200);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));

    socket.connect(port, host);
  });
}

function startProcess(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    shell: true,
    stdio: 'pipe',
    env: process.env,
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(`[${label}] ${data}`);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(`[${label}] ${data}`);
  });

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
    }
  });

  return child;
}

(async () => {
  const backendPortInUse = await checkPortOpen(5000);
  const frontendPortInUse = await checkPortOpen(5173);

  if (backendPortInUse) {
    console.warn('[startup-check] Port 5000 is already in use. Backend may fail to start if another process is running.');
  }

  if (frontendPortInUse) {
    console.warn('[startup-check] Port 5173 is already in use. Vite may switch to another port automatically.');
  }

  const backend = startProcess('backend', 'npm', ['run', 'dev'], rootDir);
  const frontend = startProcess('frontend', 'npm', ['run', 'dev'], frontendDir);

  const shutdown = () => {
    console.log('\n[dev:all] Shutting down backend and frontend...');
    if (!backend.killed) backend.kill();
    if (!frontend.killed) frontend.kill();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
