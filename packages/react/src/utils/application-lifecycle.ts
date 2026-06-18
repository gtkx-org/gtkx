/**
 * Pluggable lifecycle for the GTK runtime, driven by an application component as
 * it mounts and unmounts.
 *
 * `withApplication` runs the installed lifecycle's `run` when a
 * `<GtkApplication>` or `<AdwApplication>` mounts and its `quit` when that
 * component unmounts. The default lifecycle delegates to `runApplication` and
 * `quitApplication` from `@gtkx/ffi`, so a mounted application keeps the GTK
 * main loop alive and an unmounted one releases it. A test harness that owns the
 * process's GTK runtime installs no-ops instead, so per-test mounts and unmounts
 * neither keep the loop alive nor quit the application.
 */

import { type GApplication, quitApplication, runApplication } from "@gtkx/ffi";

/**
 * The lifecycle an application component drives: `run` when it mounts and `quit`
 * when it unmounts, each receiving the backing application.
 */
export type ApplicationLifecycle = {
    /** Starts driving the application's run loop. */
    run(application: GApplication): void;
    /** Quits the application's run loop. */
    quit(application: GApplication): void;
};

/**
 * The lifecycle installed when none has been set: delegates to `runApplication`
 * and `quitApplication` from `@gtkx/ffi`, keeping the GTK main loop alive while
 * an application is mounted and releasing it on unmount.
 *
 * Exported so a host that installs its own lifecycle via
 * {@link setApplicationLifecycle} can fall through to the stock behavior.
 *
 * @example
 * ```tsx
 * import { defaultApplicationLifecycle, setApplicationLifecycle } from "@gtkx/react";
 *
 * setApplicationLifecycle({
 *     quit: (app) => {
 *         saveState();
 *         defaultApplicationLifecycle.quit(app);
 *     },
 * });
 * ```
 */
export const defaultApplicationLifecycle: ApplicationLifecycle = {
    run: (application) => runApplication(application),
    quit: (application) => quitApplication(application),
};

let lifecycle: ApplicationLifecycle = defaultApplicationLifecycle;

/**
 * Installs the lifecycle an application component drives as it mounts and
 * unmounts.
 *
 * Test harnesses use this to keep the GTK main loop alive across per-test mounts
 * and unmounts. Any hook the partial omits falls back to
 * {@link defaultApplicationLifecycle}; passing `null` restores the full default.
 *
 * @param next - The lifecycle hooks to install, or `null` to restore the default.
 *
 * @example
 * ```tsx
 * import { setApplicationLifecycle } from "@gtkx/react";
 *
 * setApplicationLifecycle({ run: () => {}, quit: () => {} });
 * ```
 */
export const setApplicationLifecycle = (next: Partial<ApplicationLifecycle> | null): void => {
    lifecycle = { ...defaultApplicationLifecycle, ...next };
};

/**
 * Runs the installed lifecycle's `run` for an application that has mounted.
 *
 * @param application - The backing application.
 */
export const runApplicationLifecycle = (application: GApplication): void => {
    lifecycle.run(application);
};

/**
 * Runs the installed lifecycle's `quit` for an application that has unmounted.
 *
 * @param application - The backing application.
 */
export const quitApplicationLifecycle = (application: GApplication): void => {
    lifecycle.quit(application);
};
