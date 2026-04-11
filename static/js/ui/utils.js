/* ------------------ Utilities ------------------ */

/**
 * Validates dataset or job IDs.
 */
export const isValidId = (id) => /^[a-zA-Z0-9_-]+$/.test(id);

/**
 * Normalizes column names for UI DISPLAY only.
 * DO NOT use this for API payloads as it strips original characters.
 */
export const formatColumnForDisplay = (col) =>
  String(col).replace(/[^a-zA-Z0-9_ ]/g, "");

/**
 * Wraps a promise with a timeout to prevent infinite polling or hanging requests.
 * @param {Promise} promise - The async operation to wrap.
 * @param {number} ms - Timeout in milliseconds.
 */
export const withTimeout = (promise, ms = 10000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), ms)
    ),
  ]);
