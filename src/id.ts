// Random DOM-safe node id: a UUID whose leading digit is remapped to a letter (a-f) so it is a valid, CSS-selectable id token.
export function generateId(): string {
  const uuid = crypto.randomUUID()
  if (/^[a-f]/.test(uuid)) return uuid
  return String.fromCharCode(97 + (parseInt(uuid[0], 16) % 6)) + uuid.slice(1)
}
