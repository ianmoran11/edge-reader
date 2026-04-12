import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const svgPath = join(rootDir, 'public', 'icon.svg');
const svg = readFileSync(svgPath);

await sharp(svg)
  .resize(192, 192)
  .png()
  .toFile(join(rootDir, 'public', 'icon-192.png'));
await sharp(svg)
  .resize(512, 512)
  .png()
  .toFile(join(rootDir, 'public', 'icon-512.png'));

console.log('Icons generated successfully');
