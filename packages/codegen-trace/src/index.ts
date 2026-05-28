/**
 * `@gtkx/codegen-trace` — captures every `@gtkx/native` operation a test
 * suite makes so the FFI surface produced by the code generator can be
 * pinned with a deterministic golden manifest.
 *
 * Add the plugin to the relevant `vitest.config.ts`, set
 * `GTKX_CODEGEN_TRACE=1`, run the test suite, and then build the manifest
 * with the `gtkx-codegen-manifest` CLI.
 */

export { default as plugin } from "./plugin.js";
export type { Shape, Sink } from "./recorder.js";
export { recorder } from "./recorder.js";
export { buildManifest, type Manifest, type ManifestEntry, writeManifest } from "./manifest.js";
