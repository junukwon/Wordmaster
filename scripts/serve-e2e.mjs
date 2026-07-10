import { spawn, spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = {
  ...process.env,
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'wordmaster-e2e/wordmaster',
};
delete env.NO_COLOR;
delete env.FORCE_COLOR;

const shell = process.platform === 'win32';
const build = spawnSync(npm, ['run', 'build'], { cwd: process.cwd(), env, stdio: 'inherit', shell });
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const preview = spawn(npm, ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
  cwd: process.cwd(), env, stdio: 'inherit', shell,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => preview.kill(signal));
}
preview.on('exit', (code) => { process.exitCode = code ?? 0; });
