import type * as GObject from "@gtkx/gi/gobject";
import type { GObjectTarget } from "../utils/gobject-target.js";
import { propToNotifySignal } from "../utils/notify-name.js";
import { useGObjectSnapshot } from "./use-gobject-snapshot.js";

type ReadableKey<T> = {
    [K in keyof T]: K extends `__${string}__`
        ? never
        : K extends string
          ? T[K] extends (...args: unknown[]) => unknown
              ? never
              : K
          : never;
}[keyof T];

export function useProperty<T extends GObject.Object, K extends ReadableKey<T>>(
    target: GObjectTarget<T>,
    propertyName: K,
): T[K] | undefined {
    return useGObjectSnapshot(target, propToNotifySignal(propertyName), (obj) => (obj ? obj[propertyName] : undefined));
}
