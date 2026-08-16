import { useLatestRef } from "@gtkx/react/internal";
import { startTransition, useLayoutEffect, useState } from "react";
import type { Collection } from "./collection.js";

type ControlledIds = string[] | null | undefined;

type ControlledSyncOptions = {
    ids: ControlledIds;
    collection: Collection;
    widget?: object | null | undefined;
    apply: (ids: ControlledIds) => void;
};

function useControlledSync(options: ControlledSyncOptions): () => void {
    const { ids, collection, widget } = options;
    const [drift, setDrift] = useState(0);

    const markDrift = (): void => {
        startTransition(() => {
            setDrift((count) => count + 1);
        });
    };

    const applyRef = useLatestRef(options.apply);

    useLayoutEffect(() => {
        applyRef.current(ids);
    }, [applyRef, widget, collection, ids, drift]);

    return markDrift;
}

export { useControlledSync };
