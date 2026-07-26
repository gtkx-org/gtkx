import type * as GObject from "@gtkx/gi/gobject";
import { GtkDropDown, GtkLabel, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { useSignal } from "@gtkx/react";
import type { ElementType, ReactNode, Ref } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CollectionModel } from "./internal/collection-model.js";
import { collectionModeOf } from "./internal/collection-model.js";
import type { CellRecord, Cells } from "./internal/use-cells.js";
import { headerRenderer, renderItemArgs, useCells } from "./internal/use-cells.js";
import { useCollectionModel } from "./internal/use-collection.js";
import { useLatest } from "./internal/use-latest.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";
import type { DropDownProps, ItemRenderer } from "./types.js";

type SelectableWidget = GObject.Object & { getSelected: () => number };

type DropDownRuntimeProps = DropDownProps<unknown, unknown> & {
    component?: ElementType | undefined;
    ref?: Ref<SelectableWidget | null> | undefined;
} & Record<string, unknown>;

type SelectionOptions = {
    widget: SelectableWidget | null;
    model: CollectionModel;
    cells: Cells;
    props: DropDownRuntimeProps;
};

const defaultItemContent = (value: unknown): ReactNode => (value == null ? null : <GtkLabel>{String(value)}</GtkLabel>);

const itemContent = (record: CellRecord, model: CollectionModel, props: DropDownRuntimeProps): ReactNode => {
    const args = renderItemArgs(record, { collection: model });
    if (args === null) return null;
    const listRenderer = record.slot === "list" ? (props.renderListItem ?? props.renderItem) : null;
    const render = (listRenderer ?? props.renderItem) as ItemRenderer<unknown> | null | undefined;
    return render != null ? render(args) : defaultItemContent(args.item);
};

const resolvePosition = (
    widget: SelectableWidget,
    model: CollectionModel,
    selectedId: string | null | undefined,
): number => {
    const requested = selectedId == null ? -1 : model.positionOf(selectedId);
    return requested >= 0 ? requested : widget.getSelected();
};

const useDropDownSelection = (options: SelectionOptions): number | undefined => {
    const { widget, model, cells } = options;
    const { items, sections, selectedId } = options.props;
    const known = useRef<string | null>(null);
    const applying = useRef(false);
    const [selected, setSelected] = useState<number | undefined>(undefined);
    const latest = useLatest(options.props);
    const applyUpdate = useCallback((): void => {
        applying.current = true;
        try {
            model.update({ items, sections });
        } finally {
            applying.current = false;
        }
    }, [model, items, sections]);
    const syncKnownSelection = useCallback(
        (position: number): void => {
            const effectiveId = model.idAt(position);
            if (effectiveId === null) {
                known.current = null;
                return;
            }
            const expectedId = selectedId ?? known.current;
            const isNew = effectiveId !== known.current;
            known.current = effectiveId;
            if (expectedId !== null && effectiveId !== expectedId && isNew) {
                latest.current.onSelectionChanged?.(effectiveId);
            }
        },
        [model, selectedId, latest],
    );
    useLayoutEffect(() => {
        if (widget === null) return;
        applyUpdate();
        cells.refresh();
        const position = resolvePosition(widget, model, selectedId);
        setSelected(position);
        syncKnownSelection(position);
    }, [widget, model, cells, selectedId, applyUpdate, syncKnownSelection]);
    const reportSelection = useCallback((): void => {
        if (widget === null || applying.current) return;
        const position = widget.getSelected();
        setSelected(position);
        const id = model.idAt(position);
        if (id === null || id === known.current) return;
        known.current = id;
        latest.current.onSelectionChanged?.(id);
    }, [widget, model, latest]);
    useSignal(widget, "notify::selected", reportSelection);
    return selected;
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
    void selectedId;
    void onSelectionChanged;
    void renderItem;
    const [widget, refCallback] = useWidgetRef<SelectableWidget>(ref);
    const model = useCollectionModel(collectionModeOf({ items, sections }));
    const cells = useCells({ collection: model, size: { width: -1, height: -1 } });
    const selected = useDropDownSelection({ widget, model, cells, props });
    const Component = component ?? GtkDropDown;
    return (
        <>
            <Component
                ref={refCallback}
                model={model.model}
                {...(selected !== undefined && { selected })}
                factory={<GtkSignalListItemFactory {...cells.item} />}
                {...(renderListItem != null && { listFactory: <GtkSignalListItemFactory {...cells.slot("list")} /> })}
                {...(typeof renderHeader === "function" && {
                    headerFactory: <GtkSignalListItemFactory {...cells.header} />,
                })}
                {...rest}
            />
            {cells.portals({
                item: (record) => itemContent(record, model, props),
                header: headerRenderer(model, renderHeader),
            })}
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
