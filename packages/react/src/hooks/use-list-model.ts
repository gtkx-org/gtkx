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
import { detectStructure, type ListStructure, structuralSignature } from "../utils/list-item-flatten.js";
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

interface ControlledState<T, S> {
    model: Gio.ListModel;
    flatModel: Gtk.StringList | undefined;
    items: ListItem<T, S>[] | undefined;
    structure: ListStructure;
    autoexpand: boolean;
    signature: string;
    rowValues: WeakMap<GObject.Object, RowValue<T, S>>;
    placeholdersById: Map<string, GObject.Object>;
}

const controlledSignature = <T, S>(
    structure: ListStructure,
    autoexpand: boolean,
    items: ListItem<T, S>[] | undefined,
): string => (structure === "flat" ? "" : `${structure}|${autoexpand ? 1 : 0}|${structuralSignature(items)}`);

const buildControlledState = <T, S>(
    items: ListItem<T, S>[] | undefined,
    autoexpand: boolean,
    structure: ListStructure,
    signature: string,
): ControlledState<T, S> => {
    const rowValues = new WeakMap<GObject.Object, RowValue<T, S>>();
    const placeholdersById = new Map<string, GObject.Object>();
    let model: Gio.ListModel;
    let flatModel: Gtk.StringList | undefined;
    if (structure === "sections") {
        model = createSectionModel(items ?? []);
    } else if (structure === "tree") {
        model = createTreeModel(items ?? [], autoexpand, rowValues, placeholdersById);
    } else {
        flatModel = createFlatModel(items?.length ?? 0);
        model = flatModel;
    }
    return { model, flatModel, items, structure, autoexpand, signature, rowValues, placeholdersById };
};

const resolveControlledState = <T, S>(
    prev: ControlledState<T, S> | null,
    items: ListItem<T, S>[] | undefined,
    autoexpand: boolean,
): ControlledState<T, S> => {
    if (prev !== null && prev.items === items && prev.autoexpand === autoexpand) return prev;
    const structure = detectStructure(items);
    const signature = controlledSignature(structure, autoexpand, items);
    if (prev === null || prev.structure !== structure) {
        return buildControlledState(items, autoexpand, structure, signature);
    }
    if (structure !== "flat" && prev.signature !== signature) {
        return buildControlledState(items, autoexpand, structure, signature);
    }
    if (structure !== "flat") {
        retagRows(items ?? [], prev.rowValues, prev.placeholdersById);
    }
    prev.items = items;
    prev.autoexpand = autoexpand;
    prev.signature = signature;
    return prev;
};

const useControlledModel = <T, S>(mode: ControlledListMode<T, S>): ListModelResult<T, S> => {
    const { items } = mode;
    const autoexpand = mode.autoexpand ?? false;
    const stateRef = useRef<ControlledState<T, S> | null>(null);
    const state = resolveControlledState(stateRef.current, items, autoexpand);
    stateRef.current = state;
    const { structure, flatModel } = state;

    useLayoutEffect(() => {
        if (flatModel !== undefined) {
            resizeFlatModel(flatModel, items?.length ?? 0);
        }
    }, [flatModel, items]);

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
