/* BYOK privacy guard for workspace serialisation.

   The user's provider keys live only in browser state and must never be
   written to the database. Before a workspace is serialised for sync we
   recursively drop any field that could carry a key, so a key can never leak
   into Postgres even if one accidentally ends up inside the tree. */

const KEY_FIELD_RE = /^(apiKey|api_key|apikey|key|keys|token|secret)$/i;

export function stripApiKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripApiKeys);
  }
  if (value !== null && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (KEY_FIELD_RE.test(key)) continue;
      cleaned[key] = stripApiKeys(val);
    }
    return cleaned;
  }
  return value;
}
