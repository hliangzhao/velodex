import { spawn } from 'node:child_process';
import { watch } from 'node:fs';

let stopping = false;
let restarting = false;
let timer;
let backend;
const client = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
  stdio: 'inherit',
});
function startBackend() {
  backend = spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit' });
  backend.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  backend.on('exit', (code) => {
    if (stopping) return;
    if (restarting) {
      restarting = false;
      startBackend();
    } else stop(code || 0);
  });
}
// fs.watch supports recursive directories on macOS, Windows and Linux in Node 22.
const watcher = watch(
  new URL('../server', import.meta.url),
  { recursive: true },
  (_event, name) => {
    if (!name || stopping || restarting) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      restarting = true;
      backend.kill('SIGTERM');
    }, 150);
  },
);
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  watcher.close();
  backend?.kill('SIGTERM');
  client.kill('SIGTERM');
  process.exitCode = code;
}
startBackend();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
client.on('error', (error) => {
  console.error(error.message);
  stop(1);
});
client.on('exit', (code) => stop(code || 0));
