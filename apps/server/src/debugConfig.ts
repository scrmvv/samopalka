/** Closed beta defaults to enabled; use DEBUG_TOOLS=0 to disable before public hosting. */
export function isDebugToolsEnabled(value: string | undefined): boolean {
  return value !== '0';
}
