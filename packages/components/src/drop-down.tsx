import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkDropDown, GtkLabel } from "@gtkx/jsx/gtk";
import type { ElementType, ReactNode, Ref } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { buildRenderItemArgs, headerSectionValue, renderCellPortals } from "./internal/cell-portals.js";
import type { CellRecord, CellTracker } from "./internal/cell-tracker.js";
import { CollectionSource } from "./internal/collection-source.js";
import { runMuted } from "./internal/mute.js";
import { useCellHarness } from "./internal/use-cell-harness.js";
import type { CollectionViewApi } from "./internal/use-collection-view.js";
import { useFactorySlot } from "./internal/use-factories.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";
import type { DropDownDeclarativeProps, DropDownProps, RenderItemProps } from "./types.js";

type DropDownWidget = {
    setModel: (model: Gio.ListModel | null) => void;
    setFactory: (factory: Gtk.ListItemFactory | null) => void;
    setListFactory: (factory: Gtk.ListItemFactory | null) => void;
    setHeaderFactory: (factory: Gtk.ListItemFactory | null) => void;
    getSelected: () => number;
    setSelected: (position: number) => void;
    on: (signal: string, handler: (...args: unknown[]) => void) => unknown;
    off: (signal: string, handler: (...args: unknown[]) => void) => unknown;
};

type DropDownRuntimeProps = DropDownDeclarativeProps<unknown, unknown> & {
    component?: ElementType | undefined;
    ref?: Ref<DropDownWidget | null> | undefined;
} & Record<string, unknown>;

type DropDownState = {
    source: CollectionSource | null;
    muteDepth: number;
    tracker: CellTracker;
    knownId: string | null;
};

type ItemRenderer = ((args: RenderItemProps<unknown>) => ReactNode) | null | undefined;

const applySelected = (widget: DropDownWidget, source: CollectionSource, selectedId: string | null | undefined) => {
    if (selectedId == null) return;
    const position = source.positionOfId(selectedId);
    if (position >= 0 && widget.getSelected() !== position) widget.setSelected(position);
};

const reportEffectiveSelection = (
    widget: DropDownWidget,
    state: DropDownState,
    selectedId: string | null | undefined,
    report: (id: string) => void,
): void => {
    const source = state.source;
    if (source === null) return;
    const effectiveId = source.idAt(widget.getSelected());
    if (effectiveId === null) {
        state.knownId = null;
        return;
    }
    const expectedId = selectedId ?? state.knownId;
    const isNew = effectiveId !== state.knownId;
    state.knownId = effectiveId;
    if (expectedId !== null && effectiveId !== expectedId && isNew) report(effectiveId);
};

const useDropDownModel = (widget: DropDownWidget | null, state: DropDownState, props: DropDownRuntimeProps): void => {
    const mode = props.sections !== undefined ? "sections" : "flat";
    const { items, sections, selectedId } = props;
    const latestRef = useRef(props);
    latestRef.current = props;
    useLayoutEffect(() => {
        if (widget === null) return;
        const source = new CollectionSource(mode);
        state.source = source;
        widget.setModel(source.presented);
        return () => {
            widget.setModel(null);
            state.source = null;
        };
    }, [widget, state, mode]);
    useLayoutEffect(() => {
        const source = state.source;
        if (widget === null || source === null) return;
        runMuted(state, () => {
            source.update({ items, sections });
            applySelected(widget, source, selectedId);
        });
        reportEffectiveSelection(widget, state, selectedId, (id) => latestRef.current.onSelectionChanged?.(id));
        state.tracker.refresh();
    }, [widget, state, mode, items, sections, selectedId]);
    useLayoutEffect(() => {
        if (widget === null) return;
        const handler = (): void => {
            if (state.muteDepth > 0 || state.source === null) return;
            const id = state.source.idAt(widget.getSelected());
            if (id === null) return;
            state.knownId = id;
            latestRef.current.onSelectionChanged?.(id);
        };
        widget.on("notify::selected", handler);
        return () => {
            widget.off("notify::selected", handler);
        };
    }, [widget, state]);
};

const defaultItemContent = (value: unknown): ReactNode => (value == null ? null : <GtkLabel>{String(value)}</GtkLabel>);

const itemContent = (record: CellRecord, api: CollectionViewApi, props: DropDownRuntimeProps): ReactNode => {
    const args = buildRenderItemArgs({ record, api, expandedIds: undefined });
    if (args === null) return null;
    const listRenderer: ItemRenderer = record.slot === "list" ? (props.renderListItem ?? props.renderItem) : null;
    const renderer: ItemRenderer = listRenderer ?? props.renderItem;
    return renderer != null ? renderer(args) : defaultItemContent(args.item);
};

const DropDownImpl = (props: DropDownRuntimeProps): ReactNode => {
    const {
        component,
        items,
        sections,
        selectedId,
        onSelectionChanged,
        renderItem,
        renderListItem,
        renderHeader,
        ref,
        ...rest
    } = props;
    void items;
    void sections;
    void selectedId;
    void onSelectionChanged;
    void renderItem;
    const [widget, refCallback] = useWidgetRef<DropDownWidget>(ref);
    const [, setVersion] = useState(0);
    const harness = useCellHarness({ width: -1, height: -1 });
    const stateRef = useRef<DropDownState | null>(null);
    stateRef.current ??= { source: null, muteDepth: 0, tracker: harness.tracker, knownId: null };
    const state = stateRef.current;
    const apiRef = useRef<CollectionViewApi | null>(null);
    apiRef.current ??= { source: () => state.source };
    const api = apiRef.current;
    harness.connect(api);
    useLayoutEffect(() => {
        state.tracker.setNotify(() => setVersion((version) => version + 1));
    }, [state]);
    useFactorySlot(widget, harness.context, "item");
    useFactorySlot(widget, harness.context, "list", renderListItem != null);
    useFactorySlot(widget, harness.context, "header", typeof renderHeader === "function");
    useDropDownModel(widget, state, props);
    const renderHeaderContent =
        typeof renderHeader === "function" ? (renderHeader as (info: { section: unknown }) => ReactNode) : null;
    const portals = renderCellPortals(harness.tracker, {
        item: (record) => itemContent(record, api, props),
        header: (record) => renderHeaderContent?.({ section: headerSectionValue(record, api) }) ?? null,
    });
    const Component = component ?? GtkDropDown;
    return (
        <>
            <Component {...rest} ref={refCallback} />
            {portals}
        </>
    );
};

type DropDownComponent = <T = unknown, S = unknown, C extends ElementType = typeof GtkDropDown>(
    props: DropDownProps<T, S, C>,
) => ReactNode;

/**
 * Renders a drop-down backed by a collection model, with customizable renderers for the
 * collapsed display, popup rows, and popup section headers, and controlled selection.
 * The backing widget defaults to GtkDropDown and is swappable through `component`.
 */
export const DropDown: DropDownComponent = DropDownImpl as DropDownComponent;
