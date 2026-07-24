import type * as Gio from "@gtkx/gi/gio";
import { GtkDropDown, GtkLabel, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import type { ElementType, ReactNode, Ref } from "react";
import { useLayoutEffect, useRef } from "react";
import type { CollectionModel } from "./internal/collection-model.js";
import { collectionModeOf } from "./internal/collection-model.js";
import type { CellRecord, Cells } from "./internal/use-cells.js";
import { headerRenderer, renderItemArgs, useCells } from "./internal/use-cells.js";
import { useCollectionModel } from "./internal/use-collection.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";
import type { DropDownProps, ItemRenderer } from "./types.js";

type DropDownWidget = {
    setModel: (model: Gio.ListModel | null) => void;
    getSelected: () => number;
    setSelected: (position: number) => void;
    on: (signal: string, handler: () => void) => unknown;
    off: (signal: string, handler: () => void) => unknown;
};

type DropDownRuntimeProps = DropDownProps<unknown, unknown> & {
    component?: ElementType | undefined;
    ref?: Ref<DropDownWidget | null> | undefined;
} & Record<string, unknown>;

type SelectionOptions = {
    widget: DropDownWidget | null;
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

const useDropDownSelection = (options: SelectionOptions): void => {
    const { widget, model, cells } = options;
    const { items, sections, selectedId } = options.props;
    const known = useRef<string | null>(null);
    const updating = useRef(false);
    const latest = useRef(options.props);
    latest.current = options.props;
    useLayoutEffect(() => {
        if (widget === null) return;
        widget.setModel(model.model);
        return () => widget.setModel(null);
    }, [widget, model]);
    useLayoutEffect(() => {
        if (widget === null) return;
        const handler = (): void => {
            if (updating.current) return;
            const id = model.idAt(widget.getSelected());
            if (id === null || id === known.current) return;
            known.current = id;
            latest.current.onSelectionChanged?.(id);
        };
        widget.on("notify::selected", handler);
        return () => {
            widget.off("notify::selected", handler);
        };
    }, [widget, model]);
    useLayoutEffect(() => {
        if (widget === null) return;
        updating.current = true;
        try {
            model.update({ items, sections });
            if (selectedId != null) {
                const position = model.positionOf(selectedId);
                if (position >= 0 && widget.getSelected() !== position) widget.setSelected(position);
            }
        } finally {
            updating.current = false;
        }
        cells.refresh();
        const effectiveId = model.idAt(widget.getSelected());
        if (effectiveId === null) {
            known.current = null;
            return;
        }
        const expectedId = selectedId ?? known.current;
        const isNew = effectiveId !== known.current;
        known.current = effectiveId;
        if (expectedId !== null && effectiveId !== expectedId && isNew)
            latest.current.onSelectionChanged?.(effectiveId);
    }, [widget, model, cells, items, sections, selectedId]);
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
    const [widget, refCallback] = useWidgetRef<DropDownWidget>(ref);
    const model = useCollectionModel(collectionModeOf({ items, sections }));
    const cells = useCells({ collection: model, size: { width: -1, height: -1 } });
    useDropDownSelection({ widget, model, cells, props });
    const Component = component ?? GtkDropDown;
    return (
        <>
            <Component
                ref={refCallback}
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
