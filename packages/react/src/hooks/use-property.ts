import type * as GObject from "@gtkx/gi/gobject";
import { useState } from "react";
import { type GObjectTarget, resolveGobjectTarget } from "../utils/gobject-target.js";
import { propToNotifySignal } from "../utils/notify-name.js";
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

export function useProperty<T extends GObject.Object, K extends ReadableKey<T>>(
    target: GObjectTarget<T>,
    propertyName: K,
): T[K] | undefined {
    const obj = resolveGobjectTarget(target);
    const [value, setValue] = useState<T[K] | undefined>(() => (obj ? obj[propertyName] : undefined));
    const signalTarget: GObjectTarget<GObject.Object> = target;

    useSignal(
        signalTarget,
        propToNotifySignal(propertyName),
        () => {
            const current = resolveGobjectTarget(target);
            if (current) setValue(current[propertyName]);
        },
        { immediate: true },
    );

    return obj ? value : undefined;
}
