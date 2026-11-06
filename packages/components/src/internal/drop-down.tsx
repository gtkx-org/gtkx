import type * as Adw from "@gtkx/gi/adw";
import type { ElementType, ReactNode, Ref } from "react";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type * as Pango from "@gtkx/gi/pango";
import { GtkBox, GtkImage, GtkLabel, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { useProperty } from "@gtkx/react";
import { useLatestRef } from "@gtkx/react/internal";
import { omit, type Primitive } from "@gtkx/utils";
import { useLayoutEffect, useRef, useState } from "react";
import type { DropDownOwnProps, ListItemRenderer } from "../types.js";
import { ItemPortals, useItemCells, useSectionHeader } from "./cells.js";
import { type SlotRef, slotRefFor } from "./collection-model.js";
import { type Collection, isCollectionIdle } from "./collection.js";
import { useControlledSync } from "./controlled-sync.js";
import { showFirstHeader } from "./first-header.js";
import { useCollectionData } from "./use-collection.js";
import { useWidgetRef } from "./use-widget-ref.js";

type SelectableWidget = Gtk.DropDown | Adw.ComboRow;

/** Label settings of the widget's own default item factory, kept by the default renderers. */
type ItemLabelProps = {
    ellipsize?: Pango.EllipsizeMode;
    maxWidthChars?: number;
    widthChars?: number;
};

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
type ShownSelection = { ref: SlotRef | null; text: string };

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
    "itemLabel",
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

const defaultRenderer =
    (itemLabel: ItemLabelProps): ListItemRenderer<Primitive> =>
    ({ item }) =>
        item == null ? null : <GtkLabel {...itemLabel}>{String(item)}</GtkLabel>;
const faceRenderer = (props: DropDownBaseProps, itemLabel: ItemLabelProps): ListItemRenderer<never> =>
    props.renderItem ?? defaultRenderer(itemLabel);

const selectionMarkedRenderer =
    (selected: number | undefined, itemLabel: ItemLabelProps): ListItemRenderer<Primitive> =>
    ({ item, index }) => (
        <GtkBox>
            <GtkLabel xalign={0} {...itemLabel}>
                {item == null ? "" : String(item)}
            </GtkLabel>
            <GtkImage
                iconName="object-select-symbolic"
                accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                opacity={index === selected ? 1 : 0}
            />
        </GtkBox>
    );

const popupRenderer = (
    props: DropDownBaseProps,
    selected: number | undefined,
    itemLabel: ItemLabelProps,
): ListItemRenderer<never> | null =>
    props.renderListItem ?? (props.renderItem == null ? selectionMarkedRenderer(selected, itemLabel) : null);

const textOf = (value: unknown): string => {
    switch (typeof value) {
        case "string":
            return value;
        case "number":
        case "bigint":
        case "boolean":
            return String(value);
        case "symbol":
            return value.toString();
        default:
            return "";
    }
};

const slotText = (collection: Collection, ref: SlotRef | null): string =>
    ref === null ? "" : textOf(collection.itemAt(ref)?.value);

/**
 * AdwComboRow reads the selected item's text for its subtitle only when the selected item or the expression changes.
 * Slots keep their objects when an item's value changes in place, so the expression is replaced when the selected
 * item's text changes without a selection change.
 */
const useItemTextExpression = (widget: SelectableWidget | null, collection: Collection): Gtk.Expression => {
    const latest = useLatestRef(collection);
    const shown = useRef<ShownSelection>({ ref: null, text: "" });
    const createExpression = (): Gtk.Expression =>
        Gtk.ClosureExpression.new(
            GObject.TYPE_STRING,
            (object: GObject.Object | null) => slotText(latest.current, slotRefFor(object)),
            null,
        );
    const [expression, setExpression] = useState(createExpression);

    useLayoutEffect(() => {
        const ref = slotRefFor(widget?.getSelectedItem() ?? null);
        const text = slotText(collection, ref);
        const isRenamed = ref !== null && ref === shown.current.ref && text !== shown.current.text;
        shown.current = { ref, text };

        if (isRenamed) {
            setExpression(createExpression());
        }
    });

    return expression;
};

const resolvePosition = (widget: SelectableWidget, collection: Collection, selectedId: string | undefined): number => {
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

function DropDownBase(props: DropDownBaseProps & { component: ElementType; itemLabel?: ItemLabelProps }): ReactNode {
    const { component: Component, itemLabel = {}, items, sections, renderHeader, ref } = props;
    const rest = omit(props, DROP_DOWN_PROPS);
    const [widget, refCallback] = useWidgetRef<SelectableWidget>(ref);
    const { collection, model } = useCollectionData({
        items,
        sections,
        isFlat: true,
        onSectionsFilled: () => showFirstHeader(widget),
    });
    const faceCells = useItemCells({ width: -1, height: -1 });
    const listCells = useItemCells({ width: -1, height: -1 });
    const header = useSectionHeader(renderHeader, collection, { width: -1, height: -1 });
    const handleNotifySelected = useDropDownSelection({ widget, collection, props });
    const renderListItem = popupRenderer(props, useProperty(widget, "selected"), itemLabel);
    const expression = useItemTextExpression(widget, collection);

    return (
        <>
            <Component
                ref={refCallback}
                model={model}
                expression={expression}
                factory={<GtkSignalListItemFactory {...faceCells.handlers} />}
                {...(renderListItem !== null && {
                    listFactory: <GtkSignalListItemFactory {...listCells.handlers} />,
                })}
                {...header.factoryProps}
                {...rest}
                onNotifySelected={handleNotifySelected}
            />
            <ItemPortals registry={faceCells} render={faceRenderer(props, itemLabel)} collection={collection} />
            {renderListItem !== null && (
                <ItemPortals registry={listCells} render={renderListItem} collection={collection} />
            )}
            {header.portals}
        </>
    );
}

export { DropDownBase, type DropDownBaseProps };
