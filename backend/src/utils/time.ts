/** Canonical timestamp format used across the database: ISO 8601 UTC with milliseconds. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Parse a timestamp produced by any version of the schema. SQLite's legacy
 * `datetime('now')` values ("YYYY-MM-DD HH:MM:SS", UTC without a zone marker)
 * are treated as UTC; ISO strings with an explicit Z parse directly.
 */
export function parseDbDate(value: string): Date {
  if (value.includes('T')) {
    return new Date(value);
  }
  return new Date(`${value.replace(' ', 'T')}Z`);
}
