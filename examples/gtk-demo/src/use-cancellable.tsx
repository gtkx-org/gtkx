import type * as Gio from "@gtkx/gi/gio";
import { GCancellable } from "@gtkx/jsx/gio";
import { type ReactNode, useEffect, useId, useState } from "react";

type CancellableHandle = {
    cancellable: Gio.Cancellable | null;
    element: ReactNode;
    renew: () => void;
};

function useCancellable(): CancellableHandle {
    const id = useId();
    const [cancellable, setCancellable] = useState<Gio.Cancellable | null>(null);
    const [generation, setGeneration] = useState(0);

    useEffect(() => {
        if (cancellable === null) {
            return;
        }

        if (cancellable.isCancelled()) {
            queueMicrotask(() => {
                setGeneration((current) => current + 1);
            });

            return;
        }

        return () => {
            cancellable.cancel();
        };
    }, [cancellable]);

    return {
        cancellable,
        element: <GCancellable key={`${id}:${String(generation)}`} ref={setCancellable} />,
        renew: () => {
            setGeneration((current) => current + 1);
        },
    };
}

export { useCancellable, type CancellableHandle };
