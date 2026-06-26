import type * as Gtk from "@gtkx/gi/gtk";
import { useMergeRefs } from "@gtkx/react";
import { Children, cloneElement, type ReactElement, type ReactNode, type Ref, useLayoutEffect, useRef } from "react";
import { useIsInitialPresence, usePresence } from "./animate-presence.js";
import type { WidgetAnimationProps } from "./types.js";
import { useWidgetAnimation } from "./use-widget-animation.js";

type WidgetChild = ReactElement<{ ref?: Ref<Gtk.Widget | null> }>;

export const WidgetAnimation = (props: WidgetAnimationProps): ReactNode => {
    const { children, exit } = props;
    const child = Children.only(children) as WidgetChild;
    const widgetRef = useRef<Gtk.Widget | null>(null);
    const mergedRef = useMergeRefs(child.props.ref, widgetRef);

    const isInitialPresence = useIsInitialPresence();
    const animator = useWidgetAnimation(widgetRef, props, isInitialPresence);
    const [isPresent, safeToRemove] = usePresence();

    const exitStartedRef = useRef(false);
    useLayoutEffect(() => {
        if (isPresent || exitStartedRef.current) return;
        exitStartedRef.current = true;
        animator.startAnimation(exit ?? {}, () => safeToRemove?.());
    }, [isPresent, exit, animator, safeToRemove]);

    return cloneElement(child, { ref: mergedRef });
};
