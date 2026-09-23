// Copy the Crazy Games Vite output into artifacts/ and zip it with index.html
// at the archive root (Crazy Games upload layout).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist-crazygames');
const staticDir = path.join(root, 'artifacts', 'crazygames');
const zipPath = path.join(root, 'artifacts', 'get-off-the-train-crazygames.zip');

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('dist-crazygames/index.html is missing. Run vite build --mode crazygames first.');
  process.exit(1);
}

const forbidden = [
  'guest-shell.js',
  'https://alteru.app',
  'alteru.app',
  'apps.apple.com',
  'GET ALTERU',
  '下载 AlterU',
  'App Store',
];

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const leaks = [];
for (const file of walk(dist)) {
  if (!/\.(html|js|css)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const needle of forbidden) {
    if (text.includes(needle)) leaks.push(`${path.relative(root, file)} contains ${needle}`);
  }
}
if (leaks.length) {
  console.error(leaks.join('\n'));
  console.error('Crazy Games output still contains an AlterU login wall or download gate.');
  process.exit(1);
}

rmSync(staticDir, { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });
cpSync(dist, staticDir, { recursive: true });

rmSync(zipPath, { force: true });
execFileSync('zip', ['-r', '-X', zipPath, '.'], { cwd: dist, stdio: 'inherit' });

const listing = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
if (!listing.split('\n').some((line) => /\sindex\.html$/.test(line) && !line.includes('/'))) {
  console.error('zip is missing index.html at the archive root');
  process.exit(1);
}

console.log(`static: ${staticDir}`);
console.log(`zip: ${zipPath}`);
