/// <reference path="../virtual.d.ts" preserve="true" />

/**
 * Runtime window onto the project's resolved `gtkx.config.ts`: a verbatim
 * re-export of the `virtual:gtkx-config` module served by `gtkx dev`/
 * `gtkx build` and by the `@gtkx/vitest` plugin. Each resolved config field
 * is a named constant — frozen at build time, identical on every import —
 * alongside the codegen-derived metadata tables.
 *
 * @example
 * ```tsx
 * import { applicationId } from "@gtkx/config/runtime";
 * import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
 *
 * const App = () => (
 *     <GtkApplication applicationId={applicationId}>
 *         <GtkApplicationWindow title="Hello" defaultWidth={400} defaultHeight={300} />
 *     </GtkApplication>
 * );
 * ```
 */
export * from "virtual:gtkx-config";
