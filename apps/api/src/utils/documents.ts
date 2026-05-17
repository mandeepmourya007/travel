/**
 * Merges incoming document updates with existing documents.
 * Empty strings indicate deletion — keys with '' are removed from the result.
 */
export function mergeDocuments(
  existing: Record<string, string> | null,
  incoming: Record<string, string>,
): Record<string, string> {
  const merged = { ...(existing ?? {}), ...incoming }
  for (const key of Object.keys(merged)) {
    if (merged[key] === '') delete merged[key]
  }
  return merged
}
