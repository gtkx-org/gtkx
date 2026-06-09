import type { Plugin, UserConfig } from "vite";
import { loadApplicationId } from "../codegen/config-loader.js";

/** The import specifier `@gtkx/react` reads its resolved configuration from. */
const VIRTUAL_ID = "virtual:gtkx-config";

/** Rollup-convention resolved id for {@link VIRTUAL_ID} (the `\0` prefix marks it virtual). */
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * Vite plugin that serves the `virtual:gtkx-config` module `@gtkx/react`
 * imports.
 *
 * The module re-exports the codegen-derived metadata tables (`SIGNALS`,
 * `CONSTRUCT_ONLY_PROPS`, `DEFAULT_PROPS`) from the generated `@gtkx/react-gi`
 * package and adds the project's resolved `gtkx.config.ts` values (`applicationId`).
 * Delivering them through a virtual module keeps `@gtkx/react` free of any
 * dependency on `@gtkx/react-gi`: the metadata flows in through the bundler
 * rather than a package import, so the dependency graph stays one-way
 * (`@gtkx/react-gi` → `@gtkx/react`). `gtkx build` resolves and inlines the
 * module into the production bundle, so no plugin is needed at runtime.
 *
 * @returns The `gtkx:config` Vite plugin.
 */
export function gtkxConfig(): Plugin {
    let applicationId: string | undefined;

    return {
        name: "gtkx:config",

        async config(config: UserConfig) {
            applicationId = await loadApplicationId(config.root ?? process.cwd());
        },

        resolveId(id: string) {
            if (id === VIRTUAL_ID) return RESOLVED_ID;
            return undefined;
        },

        load(id: string) {
            if (id !== RESOLVED_ID) return undefined;
            return [
                'export * from "@gtkx/react-gi/metadata";',
                `export const applicationId = ${JSON.stringify(applicationId) ?? "undefined"};`,
            ].join("\n");
        },
    };
}
