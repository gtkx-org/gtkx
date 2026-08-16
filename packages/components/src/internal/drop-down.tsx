import type * as GObject from "@gtkx/gi/gobject";
import type { ElementType, ReactNode, Ref } from "react";
import { GtkLabel, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { useLatestRef } from "@gtkx/react/internal";
import { omit } from "@gtkx/utils";
import { useLayoutEffect, useRef, useState } from "react";
import type { DropDownOwnProps, ListItemRenderArgs, ListItemRenderer } from "../types.js";
import type { Collection } from "./collection.js";
import { ItemPortals, useItemCells, useSectionHeader } from "./cells.js";
import { useCollectionData } from "./use-collection.js";
import { useWidgetRef } from "./use-widget-ref.js";

type SelectableWidget = GObject.Object & { getSelected: () => number; selected: number };

type DropDownBaseProps = DropDownOwnProps<unknown, unknown> & {
    onNotifySelected?: ((value: number | null, self: SelectableWidget) => void) | null | undefined;
    ref?: Ref<SelectableWidget | null> | undefined;
} & Record<string, unknown>;

type SelectionOptions = {
    widget: SelectableWidget | null;
    collection: Collection;
    props: DropDownBaseProps;
};

type NotifySelectedHandler = NonNullable<DropDownBaseProps["onNotifySelected"]>;
type ApplyState = { isApplying: boolean };

type NotifyContext = {
    options: SelectionOptions;
    known: { current: string | null };
    state: ApplyState;
};

type KnownSelection = {
    known: { current: string | null };
    onSelectionChanged: ((id: string) => void) | null | undefined;
};

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

function newApplyState(): ApplyState {
    return { isApplying: false };
}

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

const defaultRenderItem = ({ item }: ListItemRenderArgs<unknown>): ReactNode => defaultItemContent(item);
const faceRenderer = (props: DropDownBaseProps): ListItemRenderer<never> => props.renderItem ?? defaultRenderItem;

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

const applySelectedPosition = (widget: SelectableWidget, position: number, state: ApplyState): void => {
    state.isApplying = true;

    try {
        widget.selected = position;
    } finally {
        state.isApplying = false;
    }
};

const dispatchSelectedNotify = (context: NotifyContext, value: number | null, self: SelectableWidget): void => {
    const { options, known, state } = context;

    if (state.isApplying) {
        return;
    }

    reportSelectedNotify(options, { known, onSelectionChanged: options.props.onSelectionChanged });
    options.props.onNotifySelected?.(value, self);
};

const useDropDownSelection = (options: SelectionOptions): NotifySelectedHandler => {
    const { widget, collection } = options;
    const { selectedId } = options.props;
    const known = useRef<string | null>(null);
    const [applyState] = useState<ApplyState>(newApplyState);

    const syncKnownSelection = (position: number): void => {
        const effectiveId = collection.idAt(position);

        if (effectiveId === null) {
            known.current = null;

            return;
        }

        const { onSelectionChanged } = options.props;
        updateKnownSelection({ known, onSelectionChanged }, effectiveId, selectedId);
    };

    const syncRef = useLatestRef(syncKnownSelection);

    useLayoutEffect(() => {
        if (widget === null) {
            return;
        }

        const position = resolvePosition(widget, collection, selectedId);
        applySelectedPosition(widget, position, applyState);
        syncRef.current(position);
    }, [syncRef, widget, collection, selectedId, applyState]);

    return (value, self) => {
        dispatchSelectedNotify({ options, known, state: applyState }, value, self);
    };
};

function DropDownBase(props: DropDownBaseProps & { component: ElementType }): ReactNode {
    const { component: Component, items, sections, renderListItem, renderHeader, ref } = props;
    const rest = omit(props, DROP_DOWN_PROPS);
    const [widget, refCallback] = useWidgetRef<SelectableWidget>(ref);
    const collection = useCollectionData({ items, sections, isFlat: true });
    const faceCells = useItemCells({ width: -1, height: -1 });
    const listCells = useItemCells({ width: -1, height: -1 });
    const header = useSectionHeader(renderHeader, collection, { width: -1, height: -1 });
    const handleNotifySelected = useDropDownSelection({ widget, collection, props });

    return (
        <>
            <Component
                ref={refCallback}
                model={collection.model}
                factory={<GtkSignalListItemFactory {...faceCells.handlers} />}
                {...(renderListItem != null && {
                    listFactory: <GtkSignalListItemFactory {...listCells.handlers} />,
                })}
                {...header.factoryProps}
                {...rest}
                onNotifySelected={handleNotifySelected}
            />
            <ItemPortals registry={faceCells} render={faceRenderer(props)} collection={collection} />
            {renderListItem != null && (
                <ItemPortals registry={listCells} render={renderListItem} collection={collection} />
            )}
            {header.portals}
        </>
    );
}

export { DropDownBase, type DropDownBaseProps };
