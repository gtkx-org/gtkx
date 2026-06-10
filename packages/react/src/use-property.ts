import type * as GObject from "@gtkx/gi/gobject";
import { toKebabCase } from "@gtkx/utils";
import { useEffect, useState } from "react";
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
 * Subscribes to the `notify::property-name` signal on `obj` via
 * {@link useSignal} and re-renders whenever the property changes. The initial
 * value is read synchronously at mount time. Unsubscribes automatically on
 * unmount or when inputs change.
 *
 * When `obj` is `null` or `undefined`, the hook is inactive and returns
 * `undefined`. This allows safe usage with nullable objects without
 * violating React's rules of hooks.
 *
 * @param obj - The GObject instance to observe, or null/undefined to disable
 * @param propertyName - The property name matching an ES6 accessor on the object
 * @returns The current property value, or undefined when obj is null/undefined
 *
 * @example
 * ```tsx
 * const app = useApplication();
 * const activeWindow = useProperty(app, "activeWindow");
 * const title = useProperty(activeWindow, "title");
 * ```
 */
export function useProperty<T extends GObject.Object, K extends ReadableKey<T>>(
    obj: T | null | undefined,
    propertyName: K,
): T[K] | undefined {
    const [value, setValue] = useState<T[K] | undefined>(() => (obj ? obj[propertyName] : undefined));
    const target: GObject.Object | null | undefined = obj;

    useEffect(() => {
        setValue(obj ? obj[propertyName] : undefined);
    }, [obj, propertyName]);

    useSignal(target, `notify::${toKebabCase(propertyName)}`, () => {
        if (obj) setValue(obj[propertyName]);
    });

    return value;
}
