import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, '..');
const resourcesDir = resolve(projectDir, 'resources');

await mkdir(resourcesDir, { recursive: true });
await copyFile(resolve(projectDir, 'assets', 'icon.png'), resolve(resourcesDir, 'icon-only.png'));
