import type * as GObject from "@gtkx/gi/gobject";
import type { GObjectTarget } from "../utils/gobject-target.js";
import { propToNotifySignal } from "../utils/notify-name.js";
import { useGObjectValue } from "./use-gobject-value.js";

/**
 * The readable property keys of `T`: string keys that are neither methods nor dunder-wrapped internals.
 */
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
 * Subscribes to a GObject property and returns its current value, re-rendering when the property changes.
 *
 * @param target The GObject (or ref to one) whose property to observe.
 * @param propertyName The name of a readable property on the target.
 * @returns The current property value, or `undefined` when the target is not resolved.
 */
export function useProperty<T extends GObject.Object, K extends ReadableKey<T>>(
    target: GObjectTarget<T>,
    propertyName: K,
): T[K] | undefined {
    return useGObjectValue(target, propToNotifySignal(propertyName), (obj) => (obj ? obj[propertyName] : undefined));
}
