import type * as Gtk from "@gtkx/gi/gtk";
import { useLayoutEffect, useRef, useState } from "react";
import type { ItemNode, SectionNode } from "../types.js";
import type { CellTracker } from "./cell-tracker.js";
import { type CollectionData, type CollectionMode, CollectionSource, collectionModeOf } from "./collection-source.js";
import { ExpansionController } from "./expansion-controller.js";
import { runMuted } from "./mute.js";
import { SelectionController } from "./selection-controller.js";

export type ModelHost = {
    setModel: (model: Gtk.SelectionModel | null) => void;
};

type CollectionViewOptions = {
    widget: ModelHost | null;
    tracker: CellTracker;
    items: ItemNode<unknown>[] | undefined;
    sections: SectionNode<unknown, unknown>[] | undefined;
    forcedMode?: CollectionMode | undefined;
    selectedIds: string[] | null | undefined;
    onSelectionChanged: ((ids: string[]) => void) | null | undefined;
    selectionMode: Gtk.SelectionMode | null | undefined;
    expandedIds?: string[] | null | undefined;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
};

type CollectionViewState = {
    source: CollectionSource | null;
    selection: SelectionController | null;
    expansion: ExpansionController | null;
    muteDepth: number;
};

type StableParts = {
    state: CollectionViewState;
    tracker: CellTracker;
    latest: { current: CollectionViewOptions };
};

export type CollectionViewApi = {
    source: () => CollectionSource | null;
};

export type CollectionView = {
    mode: CollectionMode;
    api: CollectionViewApi;
};

const applyControlled = (stable: StableParts): void => {
    const { state, latest } = stable;
    runMuted(state, () => {
        state.expansion?.apply(latest.current.expandedIds);
        state.selection?.apply(latest.current.selectedIds);
    });
};

const reportControlled = (stable: StableParts): void => {
    stable.state.selection?.report();
    stable.state.expansion?.report();
};

const createExpansion = (stable: StableParts, source: CollectionSource): ExpansionController | null => {
    if (source.treeModel === null) return null;
    return new ExpansionController({
        source,
        treeModel: source.treeModel,
        isMuted: () => stable.state.muteDepth > 0,
        onReport: (ids) => stable.latest.current.onExpandedChange?.(ids),
        onRowsChanged: () => stable.tracker.refresh(),
    });
};

const useSourceEffect = (stable: StableParts, widget: ModelHost | null, mode: CollectionMode): void => {
    useLayoutEffect(() => {
        if (widget === null) return;
        const source = new CollectionSource(mode);
        stable.state.source = source;
        stable.state.expansion = createExpansion(stable, source);
        return () => {
            stable.state.expansion?.dispose();
            stable.state.expansion = null;
            stable.state.source = null;
        };
    }, [stable, widget, mode]);
};

const useSelectionModelEffect = (
    stable: StableParts,
    widget: ModelHost | null,
    mode: CollectionMode,
    selectionMode: Gtk.SelectionMode | null | undefined,
): void => {
    useLayoutEffect(() => {
        const { state, latest } = stable;
        const source = state.source;
        if (widget === null || source === null) return;
        const controller = new SelectionController({
            source,
            mode: selectionMode,
            isMuted: () => state.muteDepth > 0,
            onReport: (ids) => latest.current.onSelectionChanged?.(ids),
        });
        state.selection = controller;
        widget.setModel(controller.model);
        applyControlled(stable);
        return () => {
            controller.dispose();
            state.selection = null;
            widget.setModel(null);
        };
    }, [stable, widget, mode, selectionMode]);
};

const useDataEffect = (
    stable: StableParts,
    widget: ModelHost | null,
    mode: CollectionMode,
    data: CollectionData,
): void => {
    const { items, sections } = data;
    useLayoutEffect(() => {
        const { state } = stable;
        if (widget === null || state.source === null) return;
        runMuted(state, () => {
            state.source?.update({ items, sections });
        });
        applyControlled(stable);
        reportControlled(stable);
        stable.tracker.refresh();
    }, [stable, widget, mode, items, sections]);
};

type ControlledIds = {
    selectedIds: string[] | null | undefined;
    expandedIds: string[] | null | undefined;
};

type ControlledTarget = {
    apply: (ids: string[] | null | undefined) => void;
    report: () => void;
};

const muteApplyReport = (
    state: CollectionViewState,
    target: ControlledTarget | null,
    ids: string[] | null | undefined,
): void => {
    if (target === null) return;
    runMuted(state, () => target.apply(ids));
    target.report();
};

const useControlledIdsEffect = (
    stable: StableParts,
    widget: ModelHost | null,
    mode: CollectionMode,
    controlled: ControlledIds,
): void => {
    const { selectedIds, expandedIds } = controlled;
    useLayoutEffect(() => {
        const { state } = stable;
        if (widget === null) return;
        muteApplyReport(state, state.expansion, expandedIds);
        muteApplyReport(state, state.selection, selectedIds);
    }, [stable, widget, mode, selectedIds, expandedIds]);
};

export const useCollectionView = (options: CollectionViewOptions): CollectionView => {
    const { widget, tracker, items, sections, selectedIds, selectionMode, expandedIds } = options;
    const mode = options.forcedMode ?? collectionModeOf({ items, sections });
    const [, setVersion] = useState(0);
    const latestRef = useRef(options);
    latestRef.current = options;
    const stableRef = useRef<StableParts | null>(null);
    stableRef.current ??= {
        state: { source: null, selection: null, expansion: null, muteDepth: 0 },
        tracker,
        latest: latestRef,
    };
    const stable = stableRef.current;
    useLayoutEffect(() => {
        stable.tracker.setNotify(() => setVersion((version) => version + 1));
    }, [stable]);
    useSourceEffect(stable, widget, mode);
    useSelectionModelEffect(stable, widget, mode, selectionMode);
    useDataEffect(stable, widget, mode, { items, sections });
    useControlledIdsEffect(stable, widget, mode, { selectedIds, expandedIds });
    const apiRef = useRef<CollectionViewApi | null>(null);
    apiRef.current ??= { source: () => stable.state.source };
    return { mode, api: apiRef.current };
};
