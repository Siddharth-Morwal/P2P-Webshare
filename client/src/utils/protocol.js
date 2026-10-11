/**
 * Wire protocol for WebRTC DataChannel messages.
 * 
 * Two message types flow over the DataChannel:
 * 1. Control messages (JSON strings): metadata, complete, error, hash-verify
 * 2. Chunk messages (ArrayBuffer): 4-byte LE uint32 index + raw chunk bytes
 * 
 * Receiver distinguishes them via typeof check on the incoming message.
 */

// --- Control Messages (JSON strings) ---

/**
 * Create a metadata message (sent before transfer begins).
 * @param {{ fileName: string, fileSize: number, totalChunks: number, fileHash: string, mimeType: string }} meta
 * @returns {string} JSON string
 */
export function encodeMetadata(meta) {
  return JSON.stringify({
    type: 'metadata',
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    totalChunks: meta.totalChunks,
    fileHash: meta.fileHash,
    mimeType: meta.mimeType || 'application/octet-stream',
  });
}

/**
 * Create a transfer-complete message.
 * @returns {string} JSON string
 */
export function encodeComplete() {
  return JSON.stringify({ type: 'complete' });
}

/**
 * Create an error message.
 * @param {string} message
 * @returns {string} JSON string
 */
export function encodeError(message) {
  return JSON.stringify({ type: 'error', message });
}

// --- Chunk Messages (ArrayBuffer) ---

/**
 * Encode a chunk for transmission: 4-byte LE uint32 index + raw data.
 * @param {number} index - Zero-based chunk index
 * @param {ArrayBuffer} data - Raw chunk data
 * @returns {ArrayBuffer}
 */
export function encodeChunk(index, data) {
  const header = new ArrayBuffer(4);
  const view = new DataView(header);
  view.setUint32(0, index, true); // little-endian
  
  // Combine header + data
  const combined = new Uint8Array(4 + data.byteLength);
  combined.set(new Uint8Array(header), 0);
  combined.set(new Uint8Array(data), 4);
  return combined.buffer;
}

/**
 * Decode an incoming DataChannel message.
 * @param {string | ArrayBuffer} raw - The raw message from the DataChannel
 * @returns {{ type: string, [key: string]: any }}
 */
export function decodeMessage(raw) {
  // Control message (JSON string)
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return { type: 'error', message: 'Failed to parse control message' };
    }
  }
  
  // Chunk message (ArrayBuffer)
  if (raw instanceof ArrayBuffer) {
    const view = new DataView(raw);
    const index = view.getUint32(0, true); // little-endian
    const data = raw.slice(4);
    return { type: 'chunk', index, data };
  }
  
  // Handle Blob (some browsers may deliver as Blob)
  return { type: 'error', message: 'Unexpected message format' };
}

/**
 * Message type constants.
 */
export const MSG_TYPES = {
  METADATA: 'metadata',
  CHUNK: 'chunk',
  COMPLETE: 'complete',
  ERROR: 'error',
};
