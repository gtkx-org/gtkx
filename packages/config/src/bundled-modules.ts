/**
 * Patterns matching the gtkx runtime modules that must be bundled (inlined)
 * rather than externalized when a gtkx app runs through a bundler such as Vite
 * or Vitest's SSR transform.
 *
 * These modules share the single GLib main-loop thread and the GType registry,
 * so they must resolve to one instance; externalizing them would split that
 * state. The set covers the published `@gtkx/*` runtime packages plus the
 * generated `.gtkx` store surfaced under `node_modules`.
 */
export const gtkxBundledModulePatterns: RegExp[] = [/@gtkx\/(config|ffi|gi|react|jsx|testing|css)/, /[/\\]\.gtkx[/\\]/];
