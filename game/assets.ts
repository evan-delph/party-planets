/**
 * Public asset URLs. The offline single-file build embeds every model,
 * texture and decoder as a data URI on `window.__PP_ASSETS`; the hosted game
 * serves them from public/.
 */
type Embedded = Record<string, string>;
const embedded = () =>
  (globalThis as { __PP_ASSETS?: Embedded }).__PP_ASSETS;

export function assetUrl(path: string) {
  return embedded()?.[path] ?? path;
}
export function assetsEmbedded() {
  return !!embedded();
}
