import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { createPortal, useMergeRefs } from "@gtkx/react";
import {
    cloneElement,
    isValidElement,
    type ReactElement,
    type ReactNode,
    type Ref,
    type RefCallback,
    useCallback,
    useLayoutEffect,
    useRef,
} from "react";
import { portalRoot } from "./use-placed-child.js";

type MenuElement = ReactElement<{ ref?: Ref<Gio.MenuModel | null> }>;

export const useHeaderMenu = (column: Gtk.ColumnViewColumn | null, headerMenu: ReactNode): ReactNode => {
    const modelRef = useRef<Gio.MenuModel | null>(null);
    const setModel = useCallback<RefCallback<Gio.MenuModel>>((model) => {
        modelRef.current = model;
    }, []);
    const element = isValidElement(headerMenu) ? (headerMenu as MenuElement) : null;
    const mergedRef = useMergeRefs<Gio.MenuModel>(setModel, element?.props.ref);

    useLayoutEffect(() => {
        if (column === null) return;
        column.setHeaderMenu(headerMenu == null ? null : modelRef.current);
    });

    if (element === null) return null;
    return createPortal(cloneElement(element, { ref: mergedRef }), portalRoot);
};
