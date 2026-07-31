import type * as GObject from "@gtkx/gi/gobject";
import type { ElementType, ReactNode, Ref } from "react";
import { GtkDropDown, GtkLabel, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { applyWrite } from "@gtkx/react/internal";
import { omit } from "@gtkx/utils";
import { useEffectEvent, useLayoutEffect, useRef } from "react";
import type { Collection } from "./internal/collection.js";
import type { DropDownProps, ItemRenderer, RenderItemArgs } from "./types.js";
import { HeaderPortals, ItemPortals, useHeaderCells, useItemCells } from "./internal/cells.js";
import { useCollectionData } from "./internal/use-collection.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";

type SelectableWidget = GObject.Object & { getSelected: () => number; selected: number };

type DropDownRuntimeProps = DropDownProps & {
    component?: ElementType | undefined;
    ref?: Ref<SelectableWidget | null> | undefined;
} & Record<string, unknown>;

type SelectionOptions = {
    widget: SelectableWidget | null;
    collection: Collection;
    props: DropDownRuntimeProps;
};

type NotifySelectedHandler = NonNullable<DropDownRuntimeProps["onNotifySelected"]>;

type KnownSelection = {
    known: { current: string | null };
    onSelectionChanged: ((id: string) => void) | null | undefined;
};

type DropDownComponent = <T = unknown, S = unknown, C extends ElementType = typeof GtkDropDown>(
    props: DropDownProps<T, S, C>,
) => ReactNode;

const DROP_DOWN_PROPS: string[] = [
    "component",
    "items",
    "sections",
    "selectedId",
    "onSelectionChanged",
    "onNotifySelected",
    "renderItem",
    "renderListItem",
    "renderHeader",
    "ref",
];

/**
 * Renders a drop-down backed by a collection model, with customizable renderers for the
 * collapsed display, popup rows, and popup section headers, and controlled selection.
 * The backing widget defaults to GtkDropDown and is swappable through `component`.
 */
const DropDown: DropDownComponent = DropDownImpl as DropDownComponent;

const describeValue = (value: unknown): string => {
    if (typeof value === "string") {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const defaultItemContent = (value: unknown): ReactNode =>
    value == null ? null : <GtkLabel>{describeValue(value)}</GtkLabel>;

const defaultRenderItem = ({ item }: RenderItemArgs<unknown>): ReactNode => defaultItemContent(item);

const faceRenderer = (props: DropDownRuntimeProps): ItemRenderer<never> =>
    props.renderItem ?? defaultRenderItem;

const listRenderer = (props: DropDownRuntimeProps): ItemRenderer<never> =>
    props.renderListItem ?? props.renderItem ?? defaultRenderItem;

const resolvePosition = (
    widget: SelectableWidget,
    collection: Collection,
    selectedId: string | null | undefined,
): number => {
    const requested = selectedId == null ? -1 : collection.positionFor(selectedId);

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

const reportSelectedNotify = (options: SelectionOptions, tracker: KnownSelection): void => {
    const { widget, collection } = options;

    if (widget === null) {
        return;
    }

    reportKnownSelection(tracker, collection.idAt(widget.getSelected()));
};

const applySelectedPosition = (widget: SelectableWidget, position: number): void => {
    applyWrite(widget, () => {
        widget.selected = position;
    });
};

const useDropDownSelection = (options: SelectionOptions): NotifySelectedHandler => {
    const { widget, collection } = options;
    const { selectedId } = options.props;
    const known = useRef<string | null>(null);

    const syncKnownSelection = useEffectEvent((position: number): void => {
        const effectiveId = collection.idAt(position);

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

        const position = resolvePosition(widget, collection, selectedId);
        applySelectedPosition(widget, position);
        syncKnownSelection(position);
    }, [widget, collection, selectedId]);

    return (value, self) => {
        reportSelectedNotify(options, { known, onSelectionChanged: options.props.onSelectionChanged });
        options.props.onNotifySelected?.(value, self);
    };
};

function DropDownImpl(props: DropDownRuntimeProps): ReactNode {
    const { component, items, sections, renderListItem, renderHeader, ref } = props;
    const rest = omit(props, DROP_DOWN_PROPS);
    const [widget, refCallback] = useWidgetRef<SelectableWidget>(ref);
    const collection = useCollectionData({ items, sections });
    const faceCells = useItemCells({ width: -1, height: -1 });
    const listCells = useItemCells({ width: -1, height: -1 });
    const headerCells = useHeaderCells({ width: -1, height: -1 });
    const handleNotifySelected = useDropDownSelection({ widget, collection, props });
    const Component = component ?? GtkDropDown;
    const hasHeader = typeof renderHeader === "function";

    return (
        <>
            <Component
                ref={refCallback}
                model={collection.model}
                factory={<GtkSignalListItemFactory {...faceCells.handlers} />}
                {...(renderListItem != null && {
                    listFactory: <GtkSignalListItemFactory {...listCells.handlers} />,
                })}
                {...(hasHeader && { headerFactory: <GtkSignalListItemFactory {...headerCells.handlers} /> })}
                {...rest}
                onNotifySelected={handleNotifySelected}
            />
            <ItemPortals store={faceCells} render={faceRenderer(props)} collection={collection} />
            {renderListItem != null && (
                <ItemPortals store={listCells} render={listRenderer(props)} collection={collection} />
            )}
            {hasHeader && <HeaderPortals store={headerCells} render={renderHeader} collection={collection} />}
        </>
    );
}

export { DropDown };
