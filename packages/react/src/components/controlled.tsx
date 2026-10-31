import type * as Adw from "@gtkx/gi/adw";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, type Ref, useMemo, useRef, useState } from "react";
import type { Props } from "../reconciler/registry.js";
import { type ControlledValue, useControlledValue } from "../hooks/use-controlled-value.js";
import { useRefusedCloseWarning } from "../hooks/use-dismissal.js";
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
        const value = operations.parse === undefined ? (props[prop] as V | undefined) : operations.parse(props[prop]);
        const notify = useControlledValue(ref, value, prop, operations);
        const context = useMemo(
            () =>
                operations.adoptedChildType === undefined ? null : { typeName: operations.adoptedChildType, notify },
            [notify],
        );
        const nativeProps = { ...props, ref: mergedRef };
        Reflect.deleteProperty(nativeProps, prop);
        const element = <Component {...nativeProps} />;

        return context === null ? (
            element
        ) : (
            <ControlledChildrenContext value={context}>{element}</ControlledChildrenContext>
        );
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

const createOpenStateComponent = <P extends GObject.Object>(
    Component: ElementType,
    prop: string,
    property: string,
    read: (object: P) => boolean,
    write: (object: P, value: boolean) => void,
    canApply?: (object: P, value: boolean) => boolean,
): ((props: Props) => ReactNode) =>
    createControlledComponent<P, boolean>(Component, prop, {
        signal: `notify::${property}`,
        read,
        write,
        ...(canApply === undefined ? {} : { canApply }),
        dismissedThrough: `onNotify${prop.charAt(0).toUpperCase()}${prop.slice(1)}`,
    });

const createOverlaySplitViewComponent = (Component: ElementType): ((props: Props) => ReactNode) =>
    createOpenStateComponent<Adw.OverlaySplitView>(
        Component,
        "showSidebar",
        "show-sidebar",
        (view) => view.getShowSidebar(),
        (view, show) => {
            view.setShowSidebar(show);
        },
    );

const createNavigationSplitViewComponent = (Component: ElementType): ((props: Props) => ReactNode) =>
    createOpenStateComponent<Adw.NavigationSplitView>(
        Component,
        "showContent",
        "show-content",
        (view) => view.getShowContent(),
        (view, show) => {
            view.setShowContent(show);
        },
    );

const createTabOverviewComponent = (Component: ElementType): ((props: Props) => ReactNode) =>
    createOpenStateComponent<Adw.TabOverview>(
        Component,
        "open",
        "open",
        (overview) => overview.getOpen(),
        (overview, open) => {
            overview.setOpen(open);
        },
        (overview) => (overview.getView()?.getNPages() ?? 0) > 0,
    );

const createSearchBarComponent = (Component: ElementType): ((props: Props) => ReactNode) =>
    createOpenStateComponent<Gtk.SearchBar>(
        Component,
        "searchModeEnabled",
        "search-mode-enabled",
        (bar) => bar.getSearchMode(),
        (bar, enabled) => {
            bar.setSearchMode(enabled);
        },
    );

const SHEET_CLOSE_ANSWERS = ["onNotifyOpen", "onCloseAttempt"];

const createBottomSheetComponent = (Component: ElementType): ((props: Props) => ReactNode) => {
    const ControlledSheet = createOpenStateComponent<Adw.BottomSheet>(
        Component,
        "open",
        "open",
        (sheet) => sheet.getOpen(),
        (sheet, open) => {
            sheet.setOpen(open);
        },
    );

    return (props: Props): ReactNode => {
        const [sheet, setSheet] = useState<Adw.BottomSheet | null>(null);
        const ref = useMergedRef(props.ref as Ref<Adw.BottomSheet> | undefined, setSheet);
        const isAnswered =
            props.open === undefined || SHEET_CLOSE_ANSWERS.some((name) => typeof props[name] === "function");
        const isAllowed = props.canClose !== false;

        useRefusedCloseWarning(
            sheet,
            isAllowed && !isAnswered,
            "AdwBottomSheet:close-attempt",
            () =>
                "<AdwBottomSheet> was asked to close (a swipe, Escape or a click outside the sheet), but nothing " +
                "handles onNotifyOpen, so it stays open. Update open from onNotifyOpen, or leave open out to let " +
                "the sheet manage it.",
        );

        return <ControlledSheet {...props} ref={ref} canClose={isAllowed && isAnswered} />;
    };
};

export {
    createBottomSheetComponent,
    createListBoxComponent,
    createStackComponent,
    createViewStackComponent,
    createMultiLayoutViewComponent,
    createToggleGroupComponent,
    createOverlaySplitViewComponent,
    createNavigationSplitViewComponent,
    createTabOverviewComponent,
    createSearchBarComponent,
};
