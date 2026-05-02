import type { Plugin } from "vite";

/**
 * Identifier of the virtual module that wraps the user entry with a
 * `render()` call.
 *
 * Used as the build's SSR entry so that the produced `bundle.js` is
 * directly executable (`node bundle.js` boots the app), without requiring
 * user code to import `@gtkx/react` and call `render` itself.
 */
export const GTKX_RUNNER_ID = "virtual:gtkx-runner";

const RESOLVED_RUNNER_ID = "\0virtual:gtkx-runner";

/**
 * Options for the runner plugin.
 */
export type GtkxRunnerOptions = {
    /** Absolute path to the user's entry module. */
    userEntry: string;
    /** GLib application ID baked into the runner. */
    appId: string;
    /**
     * Numeric `Gio.ApplicationFlags` bitmask to pass to `render`. Omit to
     * let the runtime apply its default flags.
     */
    appFlags?: number;
};

/**
 * Vite plugin that exposes a virtual entry module which imports the
 * user's entry and invokes `@gtkx/react`'s `render` with the configured
 * `appId` and `appFlags`.
 *
 * Lets `gtkx build` produce a self-contained, runnable `bundle.js` from
 * a user entry that only exports a default React component.
 */
export const gtkxRunner = (options: GtkxRunnerOptions): Plugin => {
    const { userEntry, appId, appFlags } = options;

    return {
        name: "gtkx:runner",
        enforce: "pre",
        resolveId(id) {
            if (id === GTKX_RUNNER_ID) {
                return RESOLVED_RUNNER_ID;
            }
            return undefined;
        },
        load(id) {
            if (id !== RESOLVED_RUNNER_ID) {
                return undefined;
            }

            const flagsArg = appFlags === undefined ? "" : `, ${JSON.stringify(appFlags)}`;

            return [
                `import { jsx } from "react/jsx-runtime";`,
                `import { render } from "@gtkx/react";`,
                `import App from ${JSON.stringify(userEntry)};`,
                `render(jsx(App, {}), ${JSON.stringify(appId)}${flagsArg});`,
                "",
            ].join("\n");
        },
    };
};
