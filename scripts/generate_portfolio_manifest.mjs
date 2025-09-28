import { promises as fs } from 'fs';
import path from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORTFOLIO_DIR = path.join(ROOT, 'Portfolio');
const OUTPUT_FILE = path.join(ROOT, 'portfolio_manifest.json');
const DEFAULT_ORDER = ['Ads', 'Music Videos', 'Events', 'Graphics', 'Web', 'Zines'];

function normalizeLabel(raw) {
  if (typeof raw !== 'string') return '';
  const parts = raw.split('_');
  if (parts.length > 1 && /^\d+$/.test(parts[0])) {
    parts.shift();
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function extractIndex(raw) {
  if (typeof raw !== 'string') return '';
  const prefix = raw.split('_')[0];
  if (/^\d+$/.test(prefix)) {
    return prefix.padStart(2, '0');
  }
  return '';
}

async function readPortfolio() {
  const result = { folders: [] };
  let entries;
  try {
    entries = await fs.readdir(PORTFOLIO_DIR, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return result;
    }
    throw error;
  }

  const orderIndex = new Map(DEFAULT_ORDER.map((name, idx) => [name.toLowerCase(), idx]));
  const dirs = entries.filter(entry => entry.isDirectory());
  dirs.sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    const idxA = orderIndex.has(nameA) ? orderIndex.get(nameA) : Number.POSITIVE_INFINITY;
    const idxB = orderIndex.has(nameB) ? orderIndex.get(nameB) : Number.POSITIVE_INFINITY;
    if (idxA !== idxB) return idxA - idxB;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  for (const dir of dirs) {
    const folderPath = path.join(PORTFOLIO_DIR, dir.name);
    let subEntries = [];
    try {
      subEntries = await fs.readdir(folderPath, { withFileTypes: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const items = subEntries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(name => ({
        id: name,
        index: extractIndex(name),
        label: normalizeLabel(name).toUpperCase()
      }));

    result.folders.push({
      name: dir.name,
      items
    });
  }

  return result;
}

async function writeManifest(data) {
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(OUTPUT_FILE, json + '\n');
}

(async () => {
  const data = await readPortfolio();
  await writeManifest(data);
  console.log(`Wrote manifest with ${data.folders.length} folders to ${OUTPUT_FILE}`);
})();
