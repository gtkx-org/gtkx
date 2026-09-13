import type * as Adw from "@gtkx/gi/adw";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, type Ref, useMemo, useRef } from "react";
import type { Props } from "../reconciler/registry.js";
import { type ControlledValue, useControlledValue } from "../hooks/use-controlled-value.js";
import { useMergedRef } from "../hooks/use-merged-refs.js";
import { ControlledChildrenContext } from "./controlled-context.js";

type ControlOptions<P extends GObject.Object, V> = ControlledValue<P, V> & {
    parse?: (value: unknown) => V | undefined;
    adoptedChildType?: string;
};

const createControlledComponent = <P extends GObject.Object, V>(
    Component: ElementType,
    prop: string,
    operations: ControlOptions<P, V>,
): ((props: Props) => ReactNode) => {
    const ControlledElement = (props: Props): ReactNode => {
        const ref = useRef<P | null>(null);
        const mergedRef = useMergedRef(props.ref as Ref<P> | undefined, ref);
        const value = operations.parse === undefined ? props[prop] as V | undefined : operations.parse(props[prop]);
        const notify = useControlledValue(ref, value, prop, operations);
        const context = useMemo(() => operations.adoptedChildType === undefined
            ? null
            : { typeName: operations.adoptedChildType, notify }, [notify]);
        const nativeProps = { ...props, ref: mergedRef };
        Reflect.deleteProperty(nativeProps, prop);
        const element = <Component {...nativeProps} />;

        return context === null
            ? element
            : <ControlledChildrenContext value={context}>{element}</ControlledChildrenContext>;
    };

    return ControlledElement;
};

const desiredIndex = (input: unknown): number | undefined => {
    const value = input as number | null | undefined;

    if (value === null) {
        return -1;
    }

    if (value !== undefined && !Number.isSafeInteger(value)) {
        throw new RangeError("A selected index must be a whole number");
    }

    return value;
};

const createListBoxComponent = (Component: ElementType): ((props: Props) => ReactNode) =>
    createControlledComponent<Gtk.ListBox, number>(Component, "selectedIndex", {
        signal: "selected-rows-changed",
        parse: desiredIndex,
        read: (box) => box.getSelectedRow()?.getIndex() ?? -1,
        write: (box, index) => {
            if (index < 0) {
                box.unselectAll();
            } else {
                const row = box.getRowAtIndex(index);

                if (row !== null) {
                    box.selectRow(row);
                }
            }
        },
        observe: (box) => box.observeChildren(),
    });

const createStackComponent = (Component: ElementType): ((props: Props) => ReactNode) =>
    createControlledComponent<Gtk.Stack, string>(Component, "visibleChildName", {
        signal: "notify::visible-child-name",
        read: (stack) => stack.getVisibleChildName(),
        write: (stack, name) => {
            stack.setVisibleChildName(name);
        },
        canApply: (stack, name) => stack.getChildByName(name) !== null,
        observe: (stack) => stack.getPages(),
    });

const createViewStackComponent = (Component: ElementType): ((props: Props) => ReactNode) =>
    createControlledComponent<Adw.ViewStack, string>(Component, "visibleChildName", {
        signal: "notify::visible-child-name",
        read: (stack) => stack.getVisibleChildName(),
        write: (stack, name) => {
            stack.setVisibleChildName(name);
        },
        canApply: (stack, name) => stack.getChildByName(name) !== null,
        observe: (stack) => stack.getPages(),
    });

const createMultiLayoutViewComponent = (Component: ElementType): ((props: Props) => ReactNode) =>
    createControlledComponent<Adw.MultiLayoutView, string>(Component, "layoutName", {
        signal: "notify::layout-name",
        read: (view) => view.getLayoutName(),
        write: (view, name) => {
            view.setLayoutName(name);
        },
        canApply: (view, name) => view.getLayoutByName(name) !== null,
        adoptedChildType: "AdwLayout",
    });

const createToggleGroupComponent = (Component: ElementType): ((props: Props) => ReactNode) => {
    const NamedToggleGroup = createControlledComponent<Adw.ToggleGroup, Adw.ToggleGroup["activeName"]>(
        Component,
        "activeName",
        {
            signal: "notify::active-name",
            read: (group) => group.getActiveName(),
            write: (group, name) => {
                group.setActiveName(name);
            },
            canApply: (group, name) => name === null || group.getToggleByName(name) !== null,
            observe: (group) => group.getToggles(),
        },
    );

    return createControlledComponent<Adw.ToggleGroup, number>(NamedToggleGroup, "active", {
        signal: "notify::active",
        read: (group) => group.getActive(),
        write: (group, index) => {
            group.setActive(index);
        },
        observe: (group) => group.getToggles(),
    });
};

export {
    createListBoxComponent,
    createStackComponent,
    createViewStackComponent,
    createMultiLayoutViewComponent,
    createToggleGroupComponent,
};
