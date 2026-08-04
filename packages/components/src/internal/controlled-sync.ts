import { startTransition, useEffectEvent, useLayoutEffect, useState } from "react";

type ControlledSyncOptions<T> = {
    ids: T;
    structureKey: string;
    widget?: object | null | undefined;
    apply: (ids: T) => void;
};

function useControlledSync<T>(options: ControlledSyncOptions<T>): () => void {
    const { ids, structureKey, widget } = options;
    const [drift, setDrift] = useState(0);

    const apply = useEffectEvent((next: T): void => {
        options.apply(next);
    });

    useLayoutEffect(() => {
        apply(ids);
    }, [widget, structureKey, ids, drift]);

    return () => {
        startTransition(() => {
            setDrift((count) => count + 1);
        });
    };
}

export { useControlledSync };
