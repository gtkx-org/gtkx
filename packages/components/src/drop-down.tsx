import type * as GObject from "@gtkx/gi/gobject";
import type { ElementType, ReactNode, Ref, RefObject } from "react";
import { GtkDropDown, GtkLabel, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { useSignal } from "@gtkx/react";
import { omit } from "@gtkx/utils";
import { useCallback, useEffectEvent, useLayoutEffect, useRef } from "react";
import type { CollectionModel } from "./internal/collection-model.js";
import type { CellRecord, Cells } from "./internal/use-cells.js";
import type { DropDownProps } from "./types.js";
import { getCollectionMode } from "./internal/collection-model.js";
import { headerRenderer, renderItemArgs, useCells } from "./internal/use-cells.js";
import { useCollectionModel } from "./internal/use-collection.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";

type SelectableWidget = GObject.Object & { getSelected: () => number; selected: number };

type DropDownRuntimeProps = DropDownProps & {
    component?: ElementType | undefined;
    ref?: Ref<SelectableWidget | null> | undefined;
} & Record<string, unknown>;

type SelectionOptions = {
    widget: SelectableWidget | null;
    model: CollectionModel;
    cells: Cells;
    props: DropDownRuntimeProps;
};

type KnownSelection = {
    known: { current: string | null };
    onSelectionChanged: ((id: string) => void) | null | undefined;
};

type DropDownComponent = <T = unknown, S = unknown, C extends ElementType = typeof GtkDropDown>(
    props: DropDownProps<T, S, C>,
) => ReactNode;

/**
 * Renders a drop-down backed by a collection model, with customizable renderers for the
 * collapsed display, popup rows, and popup section headers, and controlled selection.
 * The backing widget defaults to GtkDropDown and is swappable through `component`.
 */
const DropDown: DropDownComponent = DropDownImpl as DropDownComponent;

const defaultItemContent = (value: unknown): ReactNode =>
    value == null ? null : <GtkLabel>{typeof value === "string" ? value : JSON.stringify(value)}</GtkLabel>;

const itemContent = (record: CellRecord, model: CollectionModel, props: DropDownRuntimeProps): ReactNode => {
    const args = renderItemArgs(record, { collection: model });

    if (args === null) {
        return null;
    }

    const listRenderer = record.slot === "list" ? (props.renderListItem ?? props.renderItem) : null;
    const render = (listRenderer ?? props.renderItem);

    return render == null ? defaultItemContent(args.item) : render(args);
};

const resolvePosition = (
    widget: SelectableWidget,
    model: CollectionModel,
    selectedId: string | null | undefined,
): number => {
    const requested = selectedId == null ? -1 : model.positionFor(selectedId);

    return requested >= 0 ? requested : widget.getSelected();
};

const updateKnownSelection = (
    tracker: KnownSelection,
    effectiveId: string,
    selectedId: string | null | undefined,
): void => {
    const { known, onSelectionChanged } = tracker;
    const expectedId = selectedId ?? known.current;
    const isNew = effectiveId !== known.current;
    known.current = effectiveId;

    if (expectedId !== null && effectiveId !== expectedId && isNew) {
        onSelectionChanged?.(effectiveId);
    }
};

const reportKnownSelection = (tracker: KnownSelection, id: string | null): void => {
    const { known, onSelectionChanged } = tracker;

    if (id === null || id === known.current) {
        return;
    }

    known.current = id;
    onSelectionChanged?.(id);
};

const reportSelectedNotify = (
    options: SelectionOptions,
    tracker: KnownSelection,
    applying: RefObject<boolean>,
): void => {
    const { widget, model } = options;

    if (widget === null || applying.current) {
        return;
    }

    reportKnownSelection(tracker, model.idAt(widget.getSelected()));
};

const applySelectedPosition = (widget: SelectableWidget, position: number, applying: RefObject<boolean>): void => {
    applying.current = true;

    try {
        widget.selected = position;
    } finally {
        applying.current = false;
    }
};

const useDropDownSelection = (options: SelectionOptions): void => {
    const { widget, model, cells } = options;
    const { items, sections, selectedId } = options.props;
    const known = useRef<string | null>(null);
    const applying = useRef(false);

    const applyUpdate = useCallback((): void => {
        applying.current = true;

        try {
            model.update({ items, sections });
        } finally {
            applying.current = false;
        }
    }, [model, items, sections]);

    const syncKnownSelection = useEffectEvent((position: number): void => {
        const effectiveId = model.idAt(position);

        if (effectiveId === null) {
            known.current = null;

            return;
        }

        const { onSelectionChanged } = options.props;
        updateKnownSelection({ known, onSelectionChanged }, effectiveId, selectedId);
    });

    useLayoutEffect(() => {
        if (widget === null) {
            return;
        }

        applyUpdate();
        cells.refresh();
        const position = resolvePosition(widget, model, selectedId);
        applySelectedPosition(widget, position, applying);
        syncKnownSelection(position);
    }, [widget, model, cells, selectedId, applyUpdate]);

    useSignal(widget, "notify::selected", (): void => {
        reportSelectedNotify(options, { known, onSelectionChanged: options.props.onSelectionChanged }, applying);
    });
};

function DropDownImpl(props: DropDownRuntimeProps): ReactNode {
    const { component, items, sections, renderListItem, renderHeader, ref } = props;

    const rest = omit(props, [
        "component",
        "items",
        "sections",
        "selectedId",
        "onSelectionChanged",
        "renderItem",
        "renderListItem",
        "renderHeader",
        "ref",
    ]);

    const [widget, refCallback] = useWidgetRef<SelectableWidget>(ref);
    const model = useCollectionModel(getCollectionMode({ items, sections }));
    const cells = useCells({ width: -1, height: -1 });
    useDropDownSelection({ widget, model, cells, props });
    const Component = component ?? GtkDropDown;

    return (
        <>
            <Component
                ref={refCallback}
                model={model.model}
                factory={<GtkSignalListItemFactory {...cells.item} />}
                {...(renderListItem != null && { listFactory: <GtkSignalListItemFactory {...cells.slot("list")} /> })}
                {...(typeof renderHeader === "function" && {
                    headerFactory: <GtkSignalListItemFactory {...cells.header} />,
                })}
                {...rest}
            />
            {cells.portals(
                {
                    item: (record) => itemContent(record, model, props),
                    header: headerRenderer(model, renderHeader),
                },
                model,
            )}
        </>
    );
}

export { DropDown };
