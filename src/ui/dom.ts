export type Attrs = Record<string, string | number | boolean | undefined>;

/** Small element factory shared by the UI surfaces. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, html = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  if (html) node.innerHTML = html;
  return node;
}

/** Escapes text that originates from data tables before it is placed into markup. */
export const esc = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
