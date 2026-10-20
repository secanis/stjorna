/**
 * `products.custom_fields` is a PocketBase JSON field. The SDK hands it
 * back as a parsed value (object/null), but the editor works with text.
 * These helpers convert between the two so the textarea never shows
 * `[object Object]` and saving never writes a stringified object back.
 */

export type CustomFields = Record<string, unknown>;

/** Convert the stored JSON value into editable text. */
export function formatCustomFields(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') {
    // Legacy rows may hold a JSON-encoded string; pretty-print if possible.
    try {
      const parsed = JSON.parse(value);
      if (parsed !== null && typeof parsed === 'object') {
        return JSON.stringify(parsed, null, 2);
      }
    } catch {
      // not JSON: show as-is so the user can fix it
    }
    return value;
  }
  return JSON.stringify(value, null, 2);
}

export type ParseResult =
  | { ok: true; value: CustomFields | null }
  | { ok: false; error: string };

/** Parse and validate the editor text. Empty input clears the field. */
export function parseCustomFields(text: string): ParseResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e: any) {
    return { ok: false, error: `Custom fields must be valid JSON: ${e?.message ?? 'parse error'}` };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Custom fields must be a JSON object, e.g. {"key": "value"}' };
  }
  return { ok: true, value: parsed as CustomFields };
}
