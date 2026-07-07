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
    createItemResolver,
    createSectionHeaderResolver,
    createTreeResolver,
    type ItemResolver,
    type RowValue,
} from "../utils/item-resolver.js";
import { detectStructure, type ListStructure, structuralSignature } from "../utils/list-item-flatten.js";

type ListModelInput<T, S> = {
    items: ItemNode<T>[] | undefined;
    sections?: SectionNode<S, T>[] | undefined;
};

type ListModelResult<T, S> = {
    model: Gio.ListModel;
    treeModel: Gtk.TreeListModel | null;
    resolver: ItemResolver<T, S>;
    headerResolver: ItemResolver<T, S>;
    rowValues: WeakMap<GObject.Object, RowValue<T>>;
};

type ListModelStructure = "sections" | ListStructure;

type ListModelState<T, S> = {
    model: Gio.ListModel;
    treeModel: Gtk.TreeListModel | null;
    flatModel: Gtk.StringList | undefined;
    items: ItemNode<T>[] | undefined;
    sections: SectionNode<S, T>[] | undefined;
    structure: ListModelStructure;
    signature: string;
    rowValues: WeakMap<GObject.Object, RowValue<T>>;
    placeholdersById: Map<string, GObject.Object>;
};

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

const signatureOf = <T, S>(
    structure: ListModelStructure,
    items: ItemNode<T>[] | undefined,
    sections: SectionNode<S, T>[] | undefined,
): string => {
    if (structure === "sections") return `sections|${sectionSignature(sections)}`;
    return structure === "flat" ? "" : `${structure}|${structuralSignature(items)}`;
};

type ListModelInternalInput<T, S> = {
    items: ItemNode<T>[] | undefined;
    sections: SectionNode<S, T>[] | undefined;
    structure: ListModelStructure;
    signature: string;
};

const buildState = <T, S>(input: ListModelInternalInput<T, S>): ListModelState<T, S> => {
    const { items, sections, structure, signature } = input;
    const rowValues = new WeakMap<GObject.Object, RowValue<T>>();
    const placeholdersById = new Map<string, GObject.Object>();
    let model: Gio.ListModel;
    let treeModel: Gtk.TreeListModel | null = null;
    let flatModel: Gtk.StringList | undefined;
    if (structure === "sections") {
        model = createSectionModel(sections ?? []);
    } else if (structure === "tree") {
        treeModel = createTreeModel(items ?? [], rowValues, placeholdersById);
        model = treeModel;
    } else {
        flatModel = createFlatModel(items?.length ?? 0);
        model = flatModel;
    }
    return { model, treeModel, flatModel, items, sections, structure, signature, rowValues, placeholdersById };
};

const resolveState = <T, S>(
    prev: ListModelState<T, S> | null,
    items: ItemNode<T>[] | undefined,
    sections: SectionNode<S, T>[] | undefined,
): ListModelState<T, S> => {
    if (prev !== null && prev.items === items && prev.sections === sections) {
        return prev;
    }
    const structure: ListModelStructure = sections !== undefined ? "sections" : detectStructure(items);
    const signature = signatureOf(structure, items, sections);
    const input: ListModelInternalInput<T, S> = { items, sections, structure, signature };
    if (prev === null || prev.structure !== structure) {
        return buildState(input);
    }
    if (structure !== "flat" && prev.signature !== signature) {
        return buildState(input);
    }
    if (structure === "tree") {
        retagRows(items ?? [], prev.rowValues, prev.placeholdersById);
    }
    prev.items = items;
    prev.sections = sections;
    prev.signature = signature;
    return prev;
};

export const useListModel = <T, S>(input: ListModelInput<T, S>): ListModelResult<T, S> => {
    const { items, sections } = input;
    const stateRef = useRef<ListModelState<T, S> | null>(null);
    const state = resolveState(stateRef.current, items, sections);
    stateRef.current = state;
    const { structure, flatModel } = state;

    useLayoutEffect(() => {
        if (flatModel !== undefined) {
            resizeFlatModel(flatModel, items?.length ?? 0);
        }
    }, [flatModel, items]);

    const resolver = useMemo(() => {
        if (structure === "sections") {
            return createItemResolver<T, S>(sectionRows(sections), true, state.rowValues);
        }
        if (structure === "tree" && state.treeModel !== null) {
            return createTreeResolver<T, S>(items, state.rowValues, state.treeModel);
        }
        return createItemResolver<T, S>(items, false, state.rowValues);
    }, [items, sections, structure, state.rowValues, state.treeModel]);

    const headerResolver = useMemo(
        () => createSectionHeaderResolver<T, S>(structure === "sections" ? sections : undefined),
        [sections, structure],
    );

    return {
        model: state.model,
        treeModel: state.treeModel,
        resolver,
        headerResolver,
        rowValues: state.rowValues,
    };
};
