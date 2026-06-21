import type * as Gtk from "@gtkx/gi/gtk";
import { useForwardedRef } from "@gtkx/react";
import { Children, cloneElement, type ReactElement, type ReactNode, type Ref, useLayoutEffect, useRef } from "react";
import { usePresence } from "./animate-presence.js";
import type { AdwSpringAnimationProps, AdwTimedAnimationProps } from "./types.js";
import { useWidgetAnimation, type WidgetAnimationProps } from "./use-widget-animation.js";

type WidgetChild = ReactElement<{ ref?: Ref<Gtk.Widget | null> }>;

const WidgetAnimation = (props: WidgetAnimationProps): ReactNode => {
    const { children, exit } = props;
    const child = Children.only(children) as WidgetChild;
    const [widgetRef, mergedRef] = useForwardedRef(child.props.ref);

    const handle = useWidgetAnimation(widgetRef, props);
    const [isPresent, safeToRemove] = usePresence();

    const exitStartedRef = useRef(false);
    useLayoutEffect(() => {
        if (isPresent || exitStartedRef.current) return;
        exitStartedRef.current = true;
        handle.startAnimation(exit ?? {}, () => safeToRemove?.());
    }, [isPresent, exit, handle, safeToRemove]);

    return cloneElement(child, { ref: mergedRef });
};

export const AdwTimedAnimation = (props: AdwTimedAnimationProps): ReactNode => (
    <WidgetAnimation kind="timed" {...props} />
);

export const AdwSpringAnimation = (props: AdwSpringAnimationProps): ReactNode => (
    <WidgetAnimation kind="spring" {...props} />
);
