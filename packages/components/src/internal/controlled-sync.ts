import { useLatestRef } from "@gtkx/react/internal";
import { startTransition, useLayoutEffect, useState } from "react";

type ControlledSyncOptions<T> = {
    value: T;
    source?: object | null | undefined;
    target?: object | null | undefined;
    apply: (value: T) => void;
};

function useControlledSync<T>(options: ControlledSyncOptions<T>): () => void {
    const { value, source, target } = options;
    const [drift, setDrift] = useState(0);

    const markDrift = (): void => {
        startTransition(() => {
            setDrift((count) => count + 1);
        });
    };

    const applyRef = useLatestRef(options.apply);

    useLayoutEffect(() => {
        applyRef.current(value);
    }, [applyRef, target, source, value, drift]);

    return markDrift;
}

export { useControlledSync };
