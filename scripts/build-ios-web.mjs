import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, '..');
const sourceDir = resolve(projectDir, 'mobile');
const outputDir = resolve(projectDir, 'www');

await rm(outputDir, { recursive: true, force: true });
await mkdir(resolve(outputDir, 'assets'), { recursive: true });

await Promise.all([
  cp(resolve(sourceDir, 'index.html'), resolve(outputDir, 'index.html')),
  cp(resolve(sourceDir, 'styles.css'), resolve(outputDir, 'styles.css')),
  cp(resolve(projectDir, 'src', 'url-parser.js'), resolve(outputDir, 'url-parser.js')),
  cp(resolve(projectDir, 'assets', 'icon.png'), resolve(outputDir, 'assets', 'icon.png'))
]);

await build({
  entryPoints: [resolve(sourceDir, 'app.js')],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: resolve(outputDir, 'app.js'),
  target: ['safari15'],
  format: 'iife'
});

console.log(`Built iOS web bundle: ${outputDir}`);
