/**
 * Generate a URL-friendly slug from a string.
 * Strips non-alphanumeric chars, collapses whitespace/hyphens, lowercases.
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Generate a unique slug by appending a numeric suffix if the base slug already exists.
 * @param base - The desired slug (e.g., "desi-explorers")
 * @param existsFn - Async function that returns true if a slug is taken
 */
export async function uniqueSlug(
  base: string,
  existsFn: (slug: string) => Promise<boolean>,
): Promise<string> {
  const slug = slugify(base)
  if (!(await existsFn(slug))) return slug

  let suffix = 2
  while (await existsFn(`${slug}-${suffix}`)) {
    suffix++
  }
  return `${slug}-${suffix}`
}
