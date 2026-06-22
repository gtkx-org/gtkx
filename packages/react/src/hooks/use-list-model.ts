import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { ListItem } from "../utils/element-props.js";
import {
    createControlledResolver,
    createModelResolver,
    createSectionHeaderResolver,
    type ItemResolver,
    type RowValue,
} from "../utils/item-resolver.js";
import { flattenListItems, structuralSignature } from "../utils/list-item-flatten.js";
import {
    createFlatModel,
    createSectionModel,
    createTreeModel,
    resizeFlatModel,
    retagRows,
} from "../utils/position-only-model.js";

export interface ControlledListMode<T, S> {
    items: ListItem<T, S>[] | undefined;
    autoexpand?: boolean | undefined;
    model?: never;
}

export interface UncontrolledListMode {
    model: Gio.ListModel;
    items?: never;
    autoexpand?: never;
}

export interface ListModelResult<T, S> {
    model: Gio.ListModel;
    resolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
}

type Structure = "flat" | "tree" | "sections";

const detectStructure = <T, S>(items: ListItem<T, S>[] | undefined, autoexpand: boolean): Structure => {
    const flattened = flattenListItems(items, autoexpand);
    if (flattened.isSectioned) return "sections";
    if (flattened.isTree) return "tree";
    return "flat";
};

interface ControlledState<T, S> {
    model: Gio.ListModel;
    structure: Structure;
    autoexpand: boolean;
    signature: string;
    rowValues: WeakMap<GObject.Object, RowValue<T, S>>;
    placeholdersById: Map<string, GObject.Object>;
}

const buildControlledState = <T, S>(
    items: ListItem<T, S>[] | undefined,
    autoexpand: boolean,
    structure: Structure,
    signature: string,
): ControlledState<T, S> => {
    const rowValues = new WeakMap<GObject.Object, RowValue<T, S>>();
    const placeholdersById = new Map<string, GObject.Object>();
    let model: Gio.ListModel;
    if (structure === "sections") {
        model = createSectionModel(items ?? [], rowValues, placeholdersById);
    } else if (structure === "tree") {
        model = createTreeModel(items ?? [], autoexpand, rowValues, placeholdersById);
    } else {
        model = createFlatModel(flattenListItems(items, false).records.length);
    }
    return { model, structure, autoexpand, signature, rowValues, placeholdersById };
};

const useControlledModel = <T, S>(mode: ControlledListMode<T, S>): ListModelResult<T, S> => {
    const { items } = mode;
    const autoexpand = mode.autoexpand ?? false;
    const structure = detectStructure(items, autoexpand);
    const signature = `${structure}|${autoexpand ? 1 : 0}|${structuralSignature(items)}`;
    const stateRef = useRef<ControlledState<T, S> | null>(null);

    if (stateRef.current === null || stateRef.current.structure !== structure) {
        stateRef.current = buildControlledState(items, autoexpand, structure, signature);
    } else if (structure === "flat") {
        stateRef.current.signature = signature;
    } else if (stateRef.current.signature === signature) {
        retagRows(items ?? [], stateRef.current.rowValues, stateRef.current.placeholdersById);
    } else {
        stateRef.current = buildControlledState(items, autoexpand, structure, signature);
    }

    const state = stateRef.current;

    useLayoutEffect(() => {
        if (structure === "flat") {
            resizeFlatModel(state.model as Gtk.StringList, flattenListItems(items, false).records.length);
        }
    }, [state.model, structure, items]);

    const resolver = useMemo(
        () => createControlledResolver(items, structure !== "flat" && autoexpand, state.rowValues),
        [items, structure, autoexpand, state.rowValues],
    );

    const headerResolver = useMemo(
        () => createSectionHeaderResolver(structure === "sections" ? items : undefined),
        [items, structure],
    );

    return { model: state.model, resolver, headerResolver };
};

const useUncontrolledModel = <T, S>(mode: UncontrolledListMode): ListModelResult<T, S> => {
    const { model } = mode;
    const resolver = useMemo<ItemResolver<T, S>>(() => createModelResolver(model), [model]);
    const headerResolver = useMemo<ItemResolver<T, S>>(() => createSectionHeaderResolver<T, S>(undefined), []);
    return { model, resolver, headerResolver };
};

export const useListModel = <T, S>(mode: ControlledListMode<T, S> | UncontrolledListMode): ListModelResult<T, S> => {
    const controlled = useControlledModel<T, S>(
        mode.model === undefined ? { items: mode.items, autoexpand: mode.autoexpand } : { items: [] },
    );
    const uncontrolled = useUncontrolledModel<T, S>(
        mode.model === undefined ? { model: EMPTY_MODEL } : { model: mode.model },
    );
    return mode.model === undefined ? controlled : uncontrolled;
};

const EMPTY_MODEL: Gio.ListModel = createFlatModel(0);
