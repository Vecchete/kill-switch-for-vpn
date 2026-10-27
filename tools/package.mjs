// Builds dist/kill-switch-for-vpn-<version>.zip from extension/, the package
// that the Microsoft Edge Add-ons and Chrome Web Store dashboards take.
// Needs Node.js 22.2 or later for zlib.crc32.
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'extension');
const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
const output = join(root, 'dist', `kill-switch-for-vpn-${manifest.version}.zip`);

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

function dosDateTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

const files = (await listFiles(source)).sort();
const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of files) {
  const name = Buffer.from(relative(source, file).split(sep).join('/'), 'utf8');
  const data = await readFile(file);
  const compressed = deflateRawSync(data, { level: 9 });
  const checksum = crc32(data);
  const { time, day } = dosDateTime((await stat(file)).mtime);

  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(day, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  localParts.push(header, name, compressed);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt16LE(time, 12);
  entry.writeUInt16LE(day, 14);
  entry.writeUInt32LE(checksum, 16);
  entry.writeUInt32LE(compressed.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  centralParts.push(entry, name);

  offset += header.length + name.length + compressed.length;
}

const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(output, Buffer.concat([...localParts, ...centralParts, end]));
console.log(`${relative(root, output)}: ${files.length} files`);
