import type * as GObject from "@gtkx/gi/gobject";
import type { ElementType, ReactNode, Ref } from "react";
import { GtkLabel, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { omit, type Primitive } from "@gtkx/utils";
import { useRef } from "react";
import type { DropDownOwnProps, ListItemRenderArgs, ListItemRenderer } from "../types.js";
import { ItemPortals, useItemCells, useSectionHeader } from "./cells.js";
import { type Collection, isCollectionIdle } from "./collection.js";
import { useControlledSync } from "./controlled-sync.js";
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
type ApplyState = { isApplying: boolean; isReady: boolean };

type NotifyContext = {
    options: SelectionOptions;
    known: { current: string | null };
    state: ApplyState;
    markDrift: () => void;
};

type KnownSelection = {
    known: { current: string | null };
    onSelectionChanged: ((id: string | null) => void) | null | undefined;
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
    return { isApplying: false, isReady: false };
}

const defaultRenderItem = ({ item }: ListItemRenderArgs<Primitive>): ReactNode =>
    item == null ? null : <GtkLabel>{String(item)}</GtkLabel>;
const faceRenderer = (props: DropDownBaseProps): ListItemRenderer<never> => props.renderItem ?? defaultRenderItem;

const resolvePosition = (
    widget: SelectableWidget,
    collection: Collection,
    selectedId: string | undefined,
): number => {
    if (selectedId === undefined) {
        return widget.getSelected();
    }

    const requested = collection.positionFor(selectedId);

    return requested >= 0 ? requested : widget.getSelected();
};

const updateKnownSelection = (
    tracker: KnownSelection,
    effectiveId: string | null,
    selectedId: string | undefined,
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

    if (id === known.current) {
        return;
    }

    known.current = id;
    onSelectionChanged?.(id);
};

const hasSelectionDrifted = (
    widget: SelectableWidget,
    collection: Collection,
    selectedId: string | undefined,
): boolean => {
    if (selectedId === undefined) {
        return false;
    }

    const requested = collection.positionFor(selectedId);

    return requested >= 0 && widget.getSelected() !== requested;
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
    const { options, known, state, markDrift } = context;

    if (state.isApplying) {
        return;
    }

    options.props.onNotifySelected?.(value, self);

    if (!state.isReady || !isCollectionIdle(options.collection)) {
        return;
    }

    reportKnownSelection(
        { known, onSelectionChanged: options.props.onSelectionChanged },
        options.collection.idAt(self.getSelected()),
    );

    if (hasSelectionDrifted(self, options.collection, options.props.selectedId)) {
        markDrift();
    }
};

const useDropDownSelection = (options: SelectionOptions): NotifySelectedHandler => {
    const { widget, collection } = options;
    const { selectedId } = options.props;
    const known = useRef<string | null>(null);
    const applyState = useRef<ApplyState>(newApplyState());

    const syncKnownSelection = (position: number, requestedId: string | undefined): void => {
        const effectiveId = collection.idAt(position);
        const { onSelectionChanged } = options.props;
        updateKnownSelection({ known, onSelectionChanged }, effectiveId, requestedId);
        applyState.current.isReady = true;
    };

    const markDrift = useControlledSync({
        value: selectedId,
        source: collection,
        target: widget,
        apply: (value) => {
            if (widget === null) {
                return;
            }

            const position = resolvePosition(widget, collection, value);
            applySelectedPosition(widget, position, applyState.current);
            syncKnownSelection(position, value);
        },
    });

    return (value, self) => {
        dispatchSelectedNotify({ options, known, state: applyState.current, markDrift }, value, self);
    };
};

function DropDownBase(props: DropDownBaseProps & { component: ElementType }): ReactNode {
    const { component: Component, items, sections, renderListItem, renderHeader, ref } = props;
    const rest = omit(props, DROP_DOWN_PROPS);
    const [widget, refCallback] = useWidgetRef<SelectableWidget>(ref);
    const { collection, model } = useCollectionData({ items, sections, isFlat: true });
    const faceCells = useItemCells({ width: -1, height: -1 });
    const listCells = useItemCells({ width: -1, height: -1 });
    const header = useSectionHeader(renderHeader, collection, { width: -1, height: -1 });
    const handleNotifySelected = useDropDownSelection({ widget, collection, props });

    return (
        <>
            <Component
                ref={refCallback}
                model={model}
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
