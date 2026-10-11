/**
 * Crypto utilities for zero-knowledge encryption (Stretch S3).
 * 
 * For MVP: all functions are passthroughs — no encryption applied.
 * For production: implement AES-GCM encryption using Web Crypto API,
 * with the encryption key placed in the URL fragment (#key=...)
 * so it never reaches the server.
 */

/**
 * Generate an AES-GCM encryption key.
 * @returns {Promise<CryptoKey | null>} null for MVP (no encryption)
 */
export async function generateKey() {
  // Stretch S3: Uncomment below to enable encryption
  // return crypto.subtle.generateKey(
  //   { name: 'AES-GCM', length: 256 },
  //   true, // extractable for URL sharing
  //   ['encrypt', 'decrypt']
  // );
  return null;
}

/**
 * Encrypt a chunk. MVP: passthrough (returns data unchanged).
 * @param {CryptoKey | null} key
 * @param {ArrayBuffer} data
 * @returns {Promise<ArrayBuffer>}
 */
export async function encryptChunk(key, data) {
  if (!key) return data;
  // Stretch S3: AES-GCM encryption
  // const iv = crypto.getRandomValues(new Uint8Array(12));
  // const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  // ... prepend IV to ciphertext
  return data;
}

/**
 * Decrypt a chunk. MVP: passthrough (returns data unchanged).
 * @param {CryptoKey | null} key
 * @param {ArrayBuffer} data
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptChunk(key, data) {
  if (!key) return data;
  // Stretch S3: AES-GCM decryption
  // const iv = new Uint8Array(data.slice(0, 12));
  // const ciphertext = data.slice(12);
  // return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return data;
}

/**
 * Export key to base64 string (for URL fragment).
 * @param {CryptoKey | null} key
 * @returns {Promise<string | null>}
 */
export async function exportKey(key) {
  if (!key) return null;
  // const raw = await crypto.subtle.exportKey('raw', key);
  // return btoa(String.fromCharCode(...new Uint8Array(raw)));
  return null;
}

/**
 * Import key from base64 string (from URL fragment).
 * @param {string | null} keyString
 * @returns {Promise<CryptoKey | null>}
 */
export async function importKey(keyString) {
  if (!keyString) return null;
  // const raw = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  // return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return null;
}
