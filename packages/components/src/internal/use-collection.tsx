import type { ReactElement } from "react";
import { useLayoutEffect, useMemo, useState } from "react";
import type { ExpansionProps, Item, Section, SelectionProps } from "../types.js";
import type { Collection } from "./collection.js";
import { createCollectionIndex } from "./collection-index.js";
import { createCollectionModel } from "./collection-model.js";
import { createCollection } from "./collection.js";
import { useExpansion } from "./expansion.js";
import { useSelection } from "./selection.js";

type CollectionDataOptions = {
    items?: Item[] | undefined;
    sections?: Section[] | undefined;
    flat?: boolean | undefined;
};

type CollectionOptions = CollectionDataOptions & SelectionProps & ExpansionProps;

type CollectionResult = {
    collection: Collection;
    selection: ReactElement;
};

function useCollectionData(options: CollectionDataOptions): Collection {
    const { items, sections, flat } = options;
    const [gtk] = useState(createCollectionModel);
    const index = useMemo(() => createCollectionIndex(items, sections, flat === true), [items, sections, flat]);
    const collection = useMemo(() => createCollection(gtk, index), [gtk, index]);

    useLayoutEffect(() => {
        gtk.sync(index);
    }, [gtk, index]);

    return collection;
}

function useCollection(options: CollectionOptions): CollectionResult {
    const collection = useCollectionData(options);
    useExpansion({ collection, expandedIds: options.expandedIds, onExpandedChange: options.onExpandedChange });

    const selection = useSelection({
        collection,
        selectedIds: options.selectedIds,
        onSelectionChanged: options.onSelectionChanged,
        selectionMode: options.selectionMode,
    });

    return { collection, selection };
}

export { useCollection, useCollectionData, type CollectionDataOptions, type CollectionOptions };
