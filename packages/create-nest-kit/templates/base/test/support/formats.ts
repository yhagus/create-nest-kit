// Formats docs/contract.md fixes for every variant, Mongo's string `_id` included.

/** A version 7 UUID, the format of every id the API returns. */
export const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** An ISO-8601 timestamp, exactly as `Date.prototype.toISOString()` writes it. */
export const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
