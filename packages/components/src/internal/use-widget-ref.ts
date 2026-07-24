import type { Ref, RefCallback } from "react";
import { useMemo, useState } from "react";

export const applyRef = <T>(ref: Ref<T | null> | null | undefined, value: T | null): void => {
    if (typeof ref === "function") ref(value);
    else if (ref != null) ref.current = value;
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
