import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type CodegenFingerprint, computeFingerprint, FINGERPRINT_FILENAME, serializeUserTables } from "@gtkx/codegen";
import type { GtkxConfig } from "@gtkx/config";
import { sortedAlpha } from "@gtkx/utils";
import { resolveGirPath } from "./gir-resolver.js";
import { resolveLibraries } from "./library-resolver.js";
import { resolveCodegenStore } from "./store-resolver.js";

/**
 * `@gtkx/jsx` modules that must exist whenever React bindings have been
 * generated: the merged metadata module and the always-present `gtk` namespace
 * module (Gtk is in the default library set). A per-namespace module's absence
 * for a newly configured library is caught by the shared gi-store fingerprint,
 * which regenerates both stores together.
 */
const REACT_GENERATED_MODULES: readonly string[] = ["metadata.js", join("gtk", "gtk.js")];

/**
 * Absolute path to the generated barrel for a `Name-Version` GIR library
 * identifier, mirroring the gi store layout: `<namespace>/index.js`.
 */
const namespaceBarrelPath = (giStoreDir: string, library: string): string => {
    const separator = library.indexOf("-");
    const namespace = (separator === -1 ? library : library.slice(0, separator)).toLowerCase();
    return join(giStoreDir, namespace, "index.js");
};

/**
 * Whether the gi store's own `node_modules/@gtkx/{ffi,gi}` symlinks resolve.
 *
 * The injected `@gtkx/gi` package imports `@gtkx/ffi` and its sibling
 * namespaces through these bundled links; `pnpm install` can prune them while
 * leaving the store tree intact, which silently breaks module resolution for
 * every generated module. Verifying the linked manifests resolve forces a
 * regeneration that restores them.
 */
const giStoreLinksResolve = (giStoreDir: string): boolean =>
    existsSync(join(giStoreDir, "node_modules", "@gtkx", "ffi", "package.json")) &&
    existsSync(join(giStoreDir, "node_modules", "@gtkx", "gi", "package.json"));

/**
 * Whether the gi store's fingerprint sentinel is absent or no longer matches the
 * current codegen version, library set, table-shaping config inputs, or GIR
 * file contents. Recomputing from the sentinel's recorded GIR file list
 * re-reads those files but does not reload or reparse the repository.
 *
 * @param giStoreDir - The hidden `@gtkx/gi` store directory
 * @param libraries - The currently-resolved library identifiers
 * @param userTables - The current config's serialized table inputs
 */
const fingerprintStale = (giStoreDir: string, libraries: readonly string[], userTables: string): boolean => {
    const sentinelPath = join(giStoreDir, FINGERPRINT_FILENAME);
    if (!existsSync(sentinelPath)) return true;
    let sentinel: CodegenFingerprint;
    try {
        sentinel = JSON.parse(readFileSync(sentinelPath, "utf8")) as CodegenFingerprint;
    } catch {
        return true;
    }
    const sortAlpha = (values: readonly string[]): string => sortedAlpha(values).join(",");
    if (sortAlpha(sentinel.libraries) !== sortAlpha(libraries)) return true;
    try {
        return computeFingerprint(sentinel.girFiles, sentinel.libraries, userTables) !== sentinel.value;
    } catch {
        return true;
    }
};

/**
 * Returns true if the injected `@gtkx/gi` (or, when the React stack — both
 * `@gtkx/react` and the `react` runtime — is present, `@gtkx/jsx`)
 * package is missing a required module or its visible alias.
 *
 * Used by `gtkx dev`/`gtkx build` and by `ensureGenerated` to auto-run
 * codegen when the store is absent, partial, or a newly configured library has
 * not been generated. The jsx-freshness branch is gated on the same
 * condition `runCodegen` uses to emit the jsx unit — both the
 * `@gtkx/react` package and the `react` runtime resolving — so a project with
 * `@gtkx/react` but no `react` runtime does not wedge on a unit that can never
 * be produced.
 * Beyond presence, it compares the gi store's fingerprint sentinel against the
 * current `@gtkx/codegen` version, resolved library set, and GIR file contents,
 * so a runtime bump or a codegen upgrade triggers a regeneration. A
 * `gtkx.config.ts` library change is caught both here and, mid-session, by the
 * `gtkx dev` config watcher. `gtkx codegen --force` wipes and regenerates
 * regardless.
 *
 * @param cwd - Project root
 * @param config - The user's resolved configuration
 * @returns True when a required generated module or alias is missing or stale
 */
export const isCodegenNeeded = (cwd: string, config: GtkxConfig): boolean => {
    try {
        const store = resolveCodegenStore(cwd);
        if (!existsSync(store.giLinkDir) || !existsSync(store.giStoreDir)) {
            return true;
        }
        if (!giStoreLinksResolve(store.giStoreDir)) {
            return true;
        }
        const girPath = resolveGirPath(config.girPath);
        const libraries = resolveLibraries(config.libraries, girPath);
        if (libraries.some((library) => !existsSync(namespaceBarrelPath(store.giStoreDir, library)))) {
            return true;
        }
        if (store.react !== null && store.realReactRuntimeDir !== null) {
            if (!existsSync(store.jsxLinkDir)) return true;
            if (REACT_GENERATED_MODULES.some((module) => !existsSync(join(store.jsxStoreDir, module)))) return true;
        }
        return fingerprintStale(store.giStoreDir, libraries, serializeUserTables(config));
    } catch {
        return true;
    }
};
