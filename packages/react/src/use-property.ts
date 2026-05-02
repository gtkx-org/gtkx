import * as GObject from "@gtkx/ffi/gobject";
import { useEffect, useState } from "react";

type ReadableKey<T> = {
    [K in keyof T]: K extends string ? (T[K] extends (...args: unknown[]) => unknown ? never : K) : never;
}[keyof T];

const toKebabCase = (str: string): string =>
    str.replaceAll(/[A-Z]/g, (c, i: number) => (i === 0 ? c.toLowerCase() : `-${c.toLowerCase()}`));

/**
 * Subscribes to a GObject property and returns its current value as React state.
 *
 * Connects to the `notify::property-name` signal on `obj` and re-renders
 * whenever the property changes. The initial value is read synchronously
 * at mount time. Disconnects automatically on unmount or when inputs change.
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

    useEffect(() => {
        if (!obj) {
            setValue(undefined);
            return;
        }

        setValue(obj[propertyName]);

        const signal = `notify::${toKebabCase(propertyName as string)}`;
        const handlerId = obj.connect(signal, () => {
            setValue(obj[propertyName]);
        });

        return () => {
            GObject.signalHandlerDisconnect(obj, handlerId);
        };
    }, [obj, propertyName]);

    return value;
}
