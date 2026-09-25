import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactElement } from "react";
import { GtkFlattenListModel } from "@gtkx/jsx/gtk";
import { useLayoutEffect, useMemo, useState } from "react";
import type { ExpansionProps, ListItem, ListSection, SelectionProps } from "../types.js";
import type { Collection } from "./collection.js";
import { createCollectionIndex } from "./collection-index.js";
import { CollectionRoot, type CollectionRootStore, createCollectionModel } from "./collection-model.js";
import { createCollection } from "./collection.js";
import { useExpansion } from "./expansion.js";
import { useSelection } from "./selection.js";

type CollectionDataOptions = {
    items?: ListItem[] | undefined;
    sections?: ListSection[] | undefined;
    isFlat?: boolean | undefined;
};

type CollectionOptions = CollectionDataOptions & SelectionProps & ExpansionProps;

type CollectionResult = {
    collection: Collection;
    selection: ReactElement;
};

type CollectionDataResult = {
    collection: Collection;
    model: ReactElement;
};

function useCollectionData(options: CollectionDataOptions): CollectionDataResult {
    const { items, sections, isFlat } = options;
    const [gtkModel] = useState(createCollectionModel);
    const [root, setRoot] = useState<CollectionRootStore | null>(null);
    const [model, setModel] = useState<Gtk.FlattenListModel | null>(null);
    const index = useMemo(() => createCollectionIndex(items, sections, isFlat === true), [items, sections, isFlat]);
    const collection = useMemo(() => createCollection(gtkModel, index, model), [gtkModel, index, model]);

    useLayoutEffect(() => {
        if (root !== null && model !== null) {
            gtkModel.bind(root, model);
        }

        return gtkModel.clear;
    }, [gtkModel, root, model]);

    useLayoutEffect(() => {
        gtkModel.sync(index);
    }, [gtkModel, index, root, model]);

    return {
        collection,
        model: <GtkFlattenListModel ref={setModel} model={<CollectionRoot ref={setRoot} />} />,
    };
}

function useCollection(options: CollectionOptions): CollectionResult {
    const { collection, model } = useCollectionData(options);

    const onItemsChanged = useExpansion({
        collection,
        expandedIds: options.expandedIds,
        onExpandedChange: options.onExpandedChange,
    });

    const selection = useSelection({
        collection,
        model,
        selectedIds: options.selectedIds,
        onSelectionChanged: options.onSelectionChanged,
        selectionMode: options.selectionMode,
        onItemsChanged,
    });

    return { collection, selection };
}

export { useCollection, useCollectionData };
