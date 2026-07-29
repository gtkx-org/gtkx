import type { ReactElement, RefObject } from "react";
import { useLayoutEffect, useMemo, useState } from "react";
import type { ExpansionProps, Item, Section, SelectionProps } from "../types.js";
import type { CollectionIndex } from "./collection-index.js";
import type { CollectionModel } from "./collection-model.js";
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
    applying?: RefObject<boolean> | undefined;
};

type CollectionOptions = CollectionDataOptions & SelectionProps & ExpansionProps;

type CollectionResult = {
    collection: Collection;
    selection: ReactElement;
};

function runSync(gtk: CollectionModel, index: CollectionIndex, applying: RefObject<boolean> | undefined): void {
    if (applying === undefined) {
        gtk.sync(index);

        return;
    }

    applying.current = true;

    try {
        gtk.sync(index);
    } finally {
        applying.current = false;
    }
}

function useCollectionData(options: CollectionDataOptions): Collection {
    const { items, sections, flat, applying } = options;
    const [gtk] = useState(createCollectionModel);
    const index = useMemo(() => createCollectionIndex(items, sections, flat === true), [items, sections, flat]);
    const collection = useMemo(() => createCollection(gtk, index), [gtk, index]);

    useLayoutEffect(() => {
        runSync(gtk, index, applying);
    }, [gtk, index, applying]);

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
