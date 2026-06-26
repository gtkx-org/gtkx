import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { ItemNode, SectionNode } from "../types.js";
import {
    createFlatModel,
    createSectionModel,
    createTreeModel,
    resizeFlatModel,
    retagRows,
} from "../utils/item-models.js";
import {
    createControlledResolver,
    createModelResolver,
    createSectionHeaderResolver,
    type ItemResolver,
    type RowValue,
} from "../utils/item-resolver.js";
import { detectStructure, type ListStructure, structuralSignature } from "../utils/list-item-flatten.js";

interface ControlledListMode<T, S> {
    items: ItemNode<T>[] | undefined;
    sections?: SectionNode<S, T>[] | undefined;
    autoexpand?: boolean | undefined;
    model?: never;
}

interface UncontrolledListMode {
    model: Gio.ListModel;
    items?: never;
    sections?: never;
    autoexpand?: never;
}

interface ListModelResult<T, S> {
    model: Gio.ListModel;
    resolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
}

type ControlledStructure = "sections" | ListStructure;

interface ControlledState<T, S> {
    model: Gio.ListModel;
    flatModel: Gtk.StringList | undefined;
    items: ItemNode<T>[] | undefined;
    sections: SectionNode<S, T>[] | undefined;
    structure: ControlledStructure;
    autoexpand: boolean;
    signature: string;
    rowValues: WeakMap<GObject.Object, RowValue<T>>;
    placeholdersById: Map<string, GObject.Object>;
}

const sectionRows = <T, S>(sections: SectionNode<S, T>[] | undefined): ItemNode<T>[] => {
    if (sections === undefined) return [];
    const rows: ItemNode<T>[] = [];
    for (const section of sections) rows.push(...section.data);
    return rows;
};

const sectionSignature = <T, S>(sections: SectionNode<S, T>[] | undefined): string => {
    if (sections === undefined) return "";
    const parts: string[] = [];
    for (const section of sections) {
        parts.push(`${section.id}{${structuralSignature(section.data)}}`);
    }
    return parts.join(",");
};

const controlledSignature = <T, S>(
    structure: ControlledStructure,
    autoexpand: boolean,
    items: ItemNode<T>[] | undefined,
    sections: SectionNode<S, T>[] | undefined,
): string => {
    if (structure === "sections") return `sections|${sectionSignature(sections)}`;
    return structure === "flat" ? "" : `${structure}|${autoexpand ? 1 : 0}|${structuralSignature(items)}`;
};

interface ControlledInput<T, S> {
    items: ItemNode<T>[] | undefined;
    sections: SectionNode<S, T>[] | undefined;
    autoexpand: boolean;
    structure: ControlledStructure;
    signature: string;
}

const buildControlledState = <T, S>(input: ControlledInput<T, S>): ControlledState<T, S> => {
    const { items, sections, autoexpand, structure, signature } = input;
    const rowValues = new WeakMap<GObject.Object, RowValue<T>>();
    const placeholdersById = new Map<string, GObject.Object>();
    let model: Gio.ListModel;
    let flatModel: Gtk.StringList | undefined;
    if (structure === "sections") {
        model = createSectionModel(sections ?? []);
    } else if (structure === "tree") {
        model = createTreeModel(items ?? [], autoexpand, rowValues, placeholdersById);
    } else {
        flatModel = createFlatModel(items?.length ?? 0);
        model = flatModel;
    }
    return { model, flatModel, items, sections, structure, autoexpand, signature, rowValues, placeholdersById };
};

const resolveControlledState = <T, S>(
    prev: ControlledState<T, S> | null,
    items: ItemNode<T>[] | undefined,
    sections: SectionNode<S, T>[] | undefined,
    autoexpand: boolean,
): ControlledState<T, S> => {
    if (prev !== null && prev.items === items && prev.sections === sections && prev.autoexpand === autoexpand) {
        return prev;
    }
    const structure: ControlledStructure = sections !== undefined ? "sections" : detectStructure(items);
    const signature = controlledSignature(structure, autoexpand, items, sections);
    const input: ControlledInput<T, S> = { items, sections, autoexpand, structure, signature };
    if (prev === null || prev.structure !== structure) {
        return buildControlledState(input);
    }
    if (structure !== "flat" && prev.signature !== signature) {
        return buildControlledState(input);
    }
    if (structure === "tree") {
        retagRows(items ?? [], prev.rowValues, prev.placeholdersById);
    }
    prev.items = items;
    prev.sections = sections;
    prev.autoexpand = autoexpand;
    prev.signature = signature;
    return prev;
};

const useControlledModel = <T, S>(mode: ControlledListMode<T, S>): ListModelResult<T, S> => {
    const { items, sections } = mode;
    const autoexpand = mode.autoexpand ?? false;
    const stateRef = useRef<ControlledState<T, S> | null>(null);
    const state = resolveControlledState(stateRef.current, items, sections, autoexpand);
    stateRef.current = state;
    const { structure, flatModel } = state;

    useLayoutEffect(() => {
        if (flatModel !== undefined) {
            resizeFlatModel(flatModel, items?.length ?? 0);
        }
    }, [flatModel, items]);

    const resolver = useMemo(() => {
        if (structure === "sections") {
            return createControlledResolver<T, S>(sectionRows(sections), true, state.rowValues);
        }
        return createControlledResolver<T, S>(items, structure === "tree" && autoexpand, state.rowValues);
    }, [items, sections, structure, autoexpand, state.rowValues]);

    const headerResolver = useMemo(
        () => createSectionHeaderResolver<T, S>(structure === "sections" ? sections : undefined),
        [sections, structure],
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
        mode.model === undefined
            ? { items: mode.items, sections: mode.sections, autoexpand: mode.autoexpand }
            : { items: [] },
    );
    const uncontrolled = useUncontrolledModel<T, S>(
        mode.model === undefined ? { model: EMPTY_MODEL } : { model: mode.model },
    );
    return mode.model === undefined ? controlled : uncontrolled;
};

const EMPTY_MODEL: Gio.ListModel = createFlatModel(0);
