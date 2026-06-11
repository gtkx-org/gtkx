import * as GObject from "@gtkx/gi/gobject";
import type { RefObject } from "react";

/**
 * A GObject target accepted by the observing hooks ({@link useSignal},
 * {@link useProperty}, {@link useTickCallback}): the object itself, a React
 * ref holding it (such as a `ref` to a JSX widget), or `null`/`undefined` to
 * keep the hook inactive.
 *
 * Targets are resolved on every render, so a hook given a ref follows it,
 * reattaching when a later commit replaces the referenced object.
 *
 * @typeParam T - The observed GObject type.
 *
 * @example
 * ```tsx
 * const windowRef = useRef<Gtk.Window | null>(null);
 * useSignal(windowRef, "notify::fullscreened", () => {
 *     setFullscreened(windowRef.current?.isFullscreen() ?? false);
 * });
 * ```
 */
export type GObjectTarget<T extends GObject.Object> = T | RefObject<T | null> | null | undefined;

/**
 * Resolves a {@link GObjectTarget} to the object it designates: the object
 * itself when given directly, the ref's current value when given a ref, and
 * `null` when the target is absent or the ref is empty.
 *
 * @typeParam T - The observed GObject type.
 * @param target - The target to resolve.
 * @returns The resolved object, or `null` when the target is inactive.
 */
export const resolveGObjectTarget = <T extends GObject.Object>(target: GObjectTarget<T>): T | null => {
    if (!target) return null;
    if (target instanceof GObject.Object) return target;
    return target.current;
};
