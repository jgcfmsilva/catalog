import fs from 'node:fs/promises';
import path from 'node:path';

export const COVERS_DIR = process.env.COVERS_DIR || '/data/covers';

// Downloads a remote image into COVERS_DIR. Returns the file name, or null on failure.
export async function saveCover(url, base) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const name = `${base}-${Date.now().toString(36)}.${ext}`;
    await fs.mkdir(COVERS_DIR, { recursive: true });
    await fs.writeFile(path.join(COVERS_DIR, name), Buffer.from(await res.arrayBuffer()));
    return name;
  } catch (e) {
    console.warn(`[covers] download failed for ${url}: ${e.message}`);
    return null;
  }
}

export async function removeCover(name) {
  if (!name) return;
  await fs.rm(path.join(COVERS_DIR, path.basename(name)), { force: true });
}
