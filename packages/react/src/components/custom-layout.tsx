import * as Gtk from "@gtkx/gi/gtk";
import { createElement, type ElementType, type ReactNode, type Ref, useCallback, useLayoutEffect, useRef } from "react";
import type { GtkCustomLayoutElementProps } from "../prop-types.js";
import { useLatestRef } from "../hooks/use-latest-ref.js";
import { useMergedRef } from "../hooks/use-merged-refs.js";

type CustomLayoutProps = GtkCustomLayoutElementProps & { ref?: Ref<Gtk.CustomLayout> | undefined };

const createCustomLayoutComponent =
    (Component: ElementType) =>
    ({ requestMode, measure, allocate, ref, ...props }: CustomLayoutProps): ReactNode => {
        const callbacks = useLatestRef({ requestMode, measure, allocate });
        const layout = useRef<Gtk.CustomLayout | null>(null);
        const mergedRef = useMergedRef(ref, layout);
        const handleRequestMode = useCallback<Gtk.CustomRequestModeFunc>(
            (widget) => callbacks.current.requestMode?.(widget) ?? Gtk.SizeRequestMode.CONSTANT_SIZE,
            [callbacks],
        );
        const handleMeasure = useCallback<Gtk.CustomMeasureFunc>(
            (...args) => callbacks.current.measure(...args),
            [callbacks],
        );
        const handleAllocate = useCallback<Gtk.CustomAllocateFunc>(
            (...args) => callbacks.current.allocate(...args),
            [callbacks],
        );

        useLayoutEffect(() => {
            layout.current?.layoutChanged();
        }, [requestMode, measure, allocate]);

        return createElement(Component, {
            ...props,
            ref: mergedRef,
            requestMode: handleRequestMode,
            measure: handleMeasure,
            allocate: handleAllocate,
        });
    };

export { createCustomLayoutComponent };
