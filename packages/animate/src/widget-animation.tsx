import type * as Gtk from "@gtkx/gi/gtk";
import { useForwardedRef } from "@gtkx/react";
import { Children, cloneElement, type ReactElement, type ReactNode, type Ref, useLayoutEffect, useRef } from "react";
import { usePresence, usePresenceInitial } from "./animate-presence.js";
import type { WidgetAnimationProps } from "./types.js";
import { useWidgetAnimation } from "./use-widget-animation.js";

type WidgetChild = ReactElement<{ ref?: Ref<Gtk.Widget | null> }>;

export const WidgetAnimation = (props: WidgetAnimationProps): ReactNode => {
    const { children, exit } = props;
    const child = Children.only(children) as WidgetChild;
    const [widgetRef, mergedRef] = useForwardedRef(child.props.ref);

    const animateOnMount = usePresenceInitial();
    const animator = useWidgetAnimation(widgetRef, props, animateOnMount);
    const [isPresent, safeToRemove] = usePresence();

    const exitStartedRef = useRef(false);
    useLayoutEffect(() => {
        if (isPresent || exitStartedRef.current) return;
        exitStartedRef.current = true;
        animator.startAnimation(exit ?? {}, () => safeToRemove?.());
    }, [isPresent, exit, animator, safeToRemove]);

    return cloneElement(child, { ref: mergedRef });
};
