import { useRef } from "react";
import { CellTracker } from "./cell-tracker.js";
import type { FactoryContext, SizeEstimates } from "./collection-factories.js";
import type { CollectionViewApi } from "./use-collection-view.js";

export type CellHarness = {
    tracker: CellTracker;
    context: FactoryContext;
    connect: (api: CollectionViewApi) => void;
};

const createHarness = (
    apiBox: { current: CollectionViewApi | null },
    estimatesRef: { current: SizeEstimates },
): CellHarness => {
    const tracker = new CellTracker();
    return {
        tracker,
        context: {
            tracker,
            source: () => apiBox.current?.source() ?? null,
            estimates: () => estimatesRef.current,
        },
        connect: (api) => {
            apiBox.current = api;
        },
    };
};

export const useCellHarness = (estimates: SizeEstimates): CellHarness => {
    const estimatesRef = useRef(estimates);
    estimatesRef.current = estimates;
    const apiBox = useRef<CollectionViewApi | null>(null);
    const harnessRef = useRef<CellHarness | null>(null);
    harnessRef.current ??= createHarness(apiBox, estimatesRef);
    return harnessRef.current;
};
