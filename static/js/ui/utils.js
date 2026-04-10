/* ------------------ Utilities ------------------ */

export const isValidId = (id) => /^[a-zA-Z0-9_-]+$/.test(id);

export const sanitizeColumn = (col) =>
  String(col).replace(/[^a-zA-Z0-9_ ]/g, "");

export const withTimeout = (promise, ms = 10000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), ms)
    ),
  ]);
