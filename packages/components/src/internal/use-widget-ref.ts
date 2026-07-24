import type { Ref, RefCallback } from "react";
import { useMemo, useState } from "react";

const refCleanups = new WeakMap<object, () => void>();

const detachCallbackRef = <T>(ref: (value: T | null) => void): void => {
    const cleanup = refCleanups.get(ref);
    if (cleanup === undefined) {
        ref(null);
        return;
    }
    refCleanups.delete(ref);
    cleanup();
};

export const applyRef = <T>(ref: Ref<T | null> | null | undefined, value: T | null): void => {
    if (typeof ref === "function") {
        if (value === null) {
            detachCallbackRef(ref);
            return;
        }
        const cleanup = ref(value);
        if (typeof cleanup === "function") refCleanups.set(ref, cleanup);
        return;
    }
    if (ref != null) ref.current = value;
};

export const useWidgetRef = <T>(external: Ref<T | null> | null | undefined): [T | null, RefCallback<T | null>] => {
    const [widget, setWidget] = useState<T | null>(null);
    const callback = useMemo<RefCallback<T | null>>(
        () => (value) => {
            applyRef(external, value);
            setWidget(value);
        },
        [external],
    );
    return [widget, callback];
};
