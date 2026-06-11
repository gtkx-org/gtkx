/**
 * Pluggable teardown for the GTK runtime, run when an application component
 * unmounts.
 *
 * `withApplication` invokes the teardown installed here from its unmount
 * cleanup, so unmounting a tree that contains a `<GtkApplication>` or
 * `<AdwApplication>` shuts the runtime down. The default teardown schedules
 * `stop` from `@gtkx/ffi` on a macrotask, letting the unmount commit finish
 * before the main loop exits. A test harness that owns the process's GTK
 * runtime installs a no-op instead, so per-test unmounts keep the loop alive.
 */

import { stop } from "@gtkx/ffi";

/** Tears down the GTK runtime after an application component unmounts. */
export type ApplicationTeardown = () => void;

/**
 * The teardown installed when none has been set: schedules `stop` from
 * `@gtkx/ffi` on a macrotask, letting the unmount commit finish before the
 * main loop exits.
 *
 * Exported so a host that installs its own teardown via
 * {@link setApplicationTeardown} can fall through to the stock behavior for
 * the unmounts it does not handle itself.
 *
 * @example
 * ```tsx
 * import { defaultApplicationTeardown, setApplicationTeardown } from "@gtkx/react";
 *
 * setApplicationTeardown(() => {
 *     if (!handledByHost()) defaultApplicationTeardown();
 * });
 * ```
 */
export const defaultApplicationTeardown: ApplicationTeardown = () => {
    setTimeout(() => {
        stop();
    }, 0);
};

let teardown: ApplicationTeardown = defaultApplicationTeardown;

/**
 * Installs the teardown run when an application component unmounts.
 *
 * Test harnesses use this to keep the GTK main loop alive across per-test
 * unmounts. Passing `null` restores the default teardown, which stops the
 * runtime on a macrotask.
 *
 * @param next - The teardown to install, or `null` to restore the default
 *
 * @example
 * ```tsx
 * import { setApplicationTeardown } from "@gtkx/react";
 *
 * setApplicationTeardown(() => {});
 * ```
 */
export const setApplicationTeardown = (next: ApplicationTeardown | null): void => {
    teardown = next ?? defaultApplicationTeardown;
};

/**
 * Runs the installed application teardown.
 */
export const runApplicationTeardown = (): void => {
    teardown();
};
