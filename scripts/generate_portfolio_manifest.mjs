import { promises as fs } from 'fs';
import path from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORTFOLIO_DIR = path.join(ROOT, 'Portfolio');
const OUTPUT_FILE = path.join(ROOT, 'portfolio_manifest.json');
const DEFAULT_ORDER = ['Ads', 'Music Videos', 'Events', 'Graphics', 'Web', 'Zines'];

const MEDIA_REGEX = /\.(gif|png)$/i;

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

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

function sanitizeFeatureVideo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  const aspectRatio = typeof raw.aspectRatio === 'string' ? raw.aspectRatio.trim() : '';
  if (!url) return null;
  return {
    url,
    aspectRatio: aspectRatio || '16:9'
  };
}

function buildExistingLookup(existing) {
  const map = new Map();
  if (!existing || !Array.isArray(existing.folders)) return map;
  existing.folders.forEach(folder => {
    if (!folder || typeof folder.name !== 'string') return;
    const folderKey = folder.name;
    if (!Array.isArray(folder.items)) return;
    const itemMap = new Map();
    folder.items.forEach(item => {
      if (!item || typeof item.id !== 'string') return;
      itemMap.set(item.id, item);
    });
    map.set(folderKey, itemMap);
  });
  return map;
}

async function readExistingManifest() {
  try {
    const raw = await fs.readFile(OUTPUT_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function readPortfolio(existingManifest) {
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

  const lookup = buildExistingLookup(existingManifest);

  for (const dir of dirs) {
    const folderPath = path.join(PORTFOLIO_DIR, dir.name);
    let subEntries = [];
    try {
      subEntries = await fs.readdir(folderPath, { withFileTypes: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const items = [];
    const previousItems = lookup.get(dir.name) ?? new Map();
    const foldersOnly = subEntries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    for (const name of foldersOnly) {
      const itemPath = path.join(folderPath, name);
      let mediaEntries = [];
      try {
        mediaEntries = await fs.readdir(itemPath, { withFileTypes: true });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }

      const media = mediaEntries
        .filter(entry => entry.isFile() && MEDIA_REGEX.test(entry.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map(entry => toPosix(path.relative(ROOT, path.join(itemPath, entry.name))));

      const existingItem = previousItems.get(name);
      const featureVideo = sanitizeFeatureVideo(existingItem?.featureVideo);

      items.push({
        id: name,
        index: extractIndex(name),
        label: normalizeLabel(name).toUpperCase(),
        media,
        ...(featureVideo ? { featureVideo } : {})
      });
    }

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
  const existingManifest = await readExistingManifest();
  const data = await readPortfolio(existingManifest);
  await writeManifest(data);
  console.log(`Wrote manifest with ${data.folders.length} folders to ${OUTPUT_FILE}`);
})();
