import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ATTACHMENTS_DIR = path.resolve(__dirname, '../../uploads/attachments');
const MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB max disk usage for media

if (!fs.existsSync(ATTACHMENTS_DIR)) {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
}

/**
 * Ensures the temporary media cache does not exceed MAX_CACHE_SIZE_BYTES.
 * Evicts oldest files (LRU) until the directory size is acceptable.
 */
function enforceLRUCacheLimit() {
  try {
    const files = fs.readdirSync(ATTACHMENTS_DIR).map((file) => {
      const filePath = path.join(ATTACHMENTS_DIR, file);
      const stats = fs.statSync(filePath);
      return { file, filePath, size: stats.size, mtime: stats.mtimeMs };
    });

    let totalSize = files.reduce((acc, curr) => acc + curr.size, 0);

    if (totalSize > MAX_CACHE_SIZE_BYTES) {
      // Sort oldest first
      files.sort((a, b) => a.mtime - b.mtime);

      for (const f of files) {
        if (totalSize <= MAX_CACHE_SIZE_BYTES) break;
        fs.unlinkSync(f.filePath);
        totalSize -= f.size;
        console.log(`[MediaCache] Evicted ${f.file} to free up space.`);
      }
    }
  } catch (err) {
    console.error('[MediaCache] Error enforcing cache limit:', err);
  }
}

/**
 * Downloads a Meta Graph API CDN media URL and caches it locally.
 * Returns the permanent local internal URL.
 */
export async function downloadAndCacheAttachment(cdnUrl: string, mimeType?: string): Promise<string> {
  if (!cdnUrl || !cdnUrl.startsWith('http')) return cdnUrl;

  try {
    const res = await fetch(cdnUrl);
    if (!res.ok) throw new Error(`Failed to fetch CDN media: ${res.status}`);

    const buffer = await res.arrayBuffer();
    const ext = mimeType?.split('/')[1] || 'bin';
    const uuid = crypto.randomUUID();
    const filename = `${uuid}.${ext}`;
    const localPath = path.join(ATTACHMENTS_DIR, filename);

    fs.writeFileSync(localPath, Buffer.from(buffer));
    
    // Background enforcement of LRU limits
    setImmediate(enforceLRUCacheLimit);

    return `/uploads/attachments/${filename}`;
  } catch (err: any) {
    console.warn(`[MediaCache] Failed to cache attachment from ${cdnUrl}:`, err.message);
    return cdnUrl; // Fallback to CDN URL if download fails
  }
}
