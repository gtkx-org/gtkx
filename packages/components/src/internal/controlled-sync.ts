import { isInSignalDispatch } from "@gtkx/react/internal";
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

    const markDrift = (): void => {
        startTransition(() => {
            setDrift((count) => count + 1);
        });
    };

    const apply = useEffectEvent((next: T): void => {
        if (isInSignalDispatch()) {
            markDrift();

            return;
        }

        options.apply(next);
    });

    useLayoutEffect(() => {
        apply(ids);
    }, [widget, structureKey, ids, drift]);

    return markDrift;
}

export { useControlledSync };
