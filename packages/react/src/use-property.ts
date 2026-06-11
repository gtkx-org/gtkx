import type * as GObject from "@gtkx/gi/gobject";
import { toKebabCase } from "@gtkx/utils";
import { useState } from "react";
import { type GObjectTarget, resolveGObjectTarget } from "./gobject-target.js";
import { useSignal } from "./use-signal.js";

type ReadableKey<T> = {
    [K in keyof T]: K extends `__${string}__`
        ? never
        : K extends string
          ? T[K] extends (...args: unknown[]) => unknown
              ? never
              : K
          : never;
}[keyof T];

/**
 * Subscribes to a GObject property and returns its current value as React state.
 *
 * Subscribes to the `notify::property-name` signal on the resolved target via
 * {@link useSignal} and re-renders whenever the property changes. The value is
 * read synchronously at mount time and re-read whenever the subscription
 * reattaches to a different object.
 *
 * The target may be a React ref to a JSX widget; the subscription follows the
 * ref, reattaching when a later commit replaces the widget. When the target is
 * or resolves to `null`/`undefined`, the hook is inactive and returns
 * `undefined`. This allows safe usage with nullable objects without violating
 * React's rules of hooks.
 *
 * @param target - The GObject to observe, a ref holding it, or null/undefined to disable
 * @param propertyName - The property name matching an ES6 accessor on the object
 * @returns The current property value, or `undefined` while the hook is inactive
 *
 * @example
 * ```tsx
 * const app = useApplication();
 * const activeWindow = useProperty(app, "activeWindow");
 * const title = useProperty(activeWindow, "title");
 * ```
 *
 * @example
 * ```tsx
 * const windowRef = useRef<Gtk.Window | null>(null);
 * const title = useProperty(windowRef, "title");
 * ```
 */
export function useProperty<T extends GObject.Object, K extends ReadableKey<T>>(
    target: GObjectTarget<T>,
    propertyName: K,
): T[K] | undefined {
    const obj = resolveGObjectTarget(target);
    const [value, setValue] = useState<T[K] | undefined>(() => (obj ? obj[propertyName] : undefined));
    const signalTarget: GObjectTarget<GObject.Object> = target;

    useSignal(
        signalTarget,
        `notify::${toKebabCase(propertyName)}`,
        () => {
            const current = resolveGObjectTarget(target);
            if (current) setValue(current[propertyName]);
        },
        { immediate: true },
    );

    return obj ? value : undefined;
}
