import { spawn } from 'node:child_process';
import path from 'node:path';

const env = { ...process.env };
delete env.NO_COLOR;
delete env.FORCE_COLOR;

const cli = path.resolve('node_modules', '@playwright', 'test', 'cli.js');
const child = spawn(process.execPath, [cli, 'test', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
