/*
 * `npm run dev`: the pages (Vite, port 5173) and the FastAPI server (port 8000) together.
 * Vite passes /api through to the server, so open http://localhost:5173.
 * Either one alone: `npm run dev:web` or `npm run dev:api`.
 */
import { spawn } from 'node:child_process';

const tasks = [
  { name: 'web', script: 'dev:web' },
  { name: 'api', script: 'dev:api' },
];

// The server gets its own port; PORT may already be set for Vite by whatever started this.
const env = { ...process.env, API_PORT: process.env.API_PORT || '8000' };

const children = tasks.map(({ name, script }) => {
  const child = spawn(`npm run --silent ${script}`, { stdio: ['inherit', 'pipe', 'pipe'], shell: true, env });
  const prefix = (stream, out) =>
    stream.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line) out.write(`[${name}] ${line}\n`);
    });
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`[${name}] stopped${code ? ` (exit ${code})` : ''}`);
    stopAll();
  });
  return child;
});

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill();
  setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
