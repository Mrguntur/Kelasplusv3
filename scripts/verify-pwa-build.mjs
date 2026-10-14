import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] || 'dist');
const required = ['index.html', 'manifest.webmanifest', 'firebase-messaging-sw.js', 'pwa-192.png', 'pwa-512.png'];
for (const file of required) {
  if (!fs.existsSync(path.join(dir, file))) throw new Error(`PWA build missing: ${file}`);
}
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.webmanifest'), 'utf8'));
if (manifest.display !== 'standalone') throw new Error('Manifest display must be standalone');
for (const [size, file] of [[192, 'pwa-192.png'], [512, 'pwa-512.png']]) {
  const data = fs.readFileSync(path.join(dir, file));
  if (data.readUInt32BE(16) !== size || data.readUInt32BE(20) !== size) throw new Error(`Incorrect dimensions for ${file}`);
  if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Invalid PNG signature: ${file}`);
  if (!manifest.icons.some(icon => icon.src === `/${file}` && icon.sizes === `${size}x${size}`)) throw new Error(`Manifest icon entry missing for ${file}`);
}
const worker = fs.readFileSync(path.join(dir, 'firebase-messaging-sw.js'), 'utf8');
if (!worker.includes('notificationclick') || !worker.includes('KELASPLUS_CACHE')) throw new Error('Combined PWA/FCM service worker is incomplete');
console.log('PWA artifact validation passed: manifest, standalone mode, icons, service worker.');
