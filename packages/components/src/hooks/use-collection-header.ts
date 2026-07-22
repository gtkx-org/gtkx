import type { CellContainerStore } from "../utils/cell-container-store.js";
import { type FactoryInstaller, useCellContainers } from "./use-cell-containers.js";
import {
    type CollectionWidget,
    type CollectionWidgetInput,
    type CollectionWidgetResult,
    useCollectionWidget,
} from "./use-collection-widget.js";

type CollectionHeaderInput<W extends CollectionWidget, T, S> = CollectionWidgetInput<W, T, S> & {
    estimatedItemHeight?: number | undefined;
    estimatedItemWidth?: number | undefined;
};

type CollectionHeaderResult<W extends CollectionWidget, T, S> = CollectionWidgetResult<W, T, S> & {
    useHeader: boolean;
    headerStore: CellContainerStore;
};

export const useCollectionHeader = <W extends CollectionWidget, T, S>(
    props: CollectionHeaderInput<W, T, S>,
    headerInstaller: FactoryInstaller<W>,
): CollectionHeaderResult<W, T, S> => {
    const { widgetRef, setRef, collection } = useCollectionWidget<W, T, S>(props);
    const useHeader = collection.useHeader;
    const headerStore = useCellContainers<W>({
        object: useHeader ? widgetRef : null,
        installer: headerInstaller,
        estimatedHeight: props.estimatedItemHeight,
        estimatedWidth: props.estimatedItemWidth,
    });
    return { widgetRef, setRef, collection, useHeader, headerStore };
};
