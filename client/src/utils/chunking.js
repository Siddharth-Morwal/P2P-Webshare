/** Chunk size in bytes — 64 KB */
export const CHUNK_SIZE = 64 * 1024;

/** Maximum file size for MVP — 50 MB */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Calculate the number of chunks for a file.
 * @param {number} fileSize - File size in bytes
 * @returns {number}
 */
export function getChunkCount(fileSize) {
  return Math.ceil(fileSize / CHUNK_SIZE);
}

/**
 * Read a specific chunk from a File object.
 * @param {File} file - The source file
 * @param {number} index - Zero-based chunk index
 * @returns {Promise<ArrayBuffer>}
 */
export async function readChunk(file, index) {
  const start = index * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, file.size);
  const slice = file.slice(start, end);
  return slice.arrayBuffer();
}

/**
 * Assemble received chunks into a Blob and trigger browser download.
 * @param {ArrayBuffer[]} chunks - Ordered array of chunk ArrayBuffers
 * @param {string} fileName - Original file name
 * @param {string} [mimeType='application/octet-stream'] - MIME type
 */
export function assembleAndDownload(chunks, fileName, mimeType = 'application/octet-stream') {
  const blob = new Blob(chunks, { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Format bytes to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

/**
 * Format seconds to human-readable duration.
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}
