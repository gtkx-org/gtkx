import type * as Gtk from "@gtkx/gi/gtk";
import { useMergeRefs } from "@gtkx/react";
import { type Ref, type RefCallback, useLayoutEffect, useRef } from "react";
import { useIsInitialPresence, usePresence } from "./animate-presence.js";
import type { WidgetAnimationProps } from "./types.js";
import { useWidgetAnimation } from "./use-widget-animation.js";

export const useAnimatedWidget = (
    externalRef: Ref<Gtk.Widget | null> | undefined,
    props: WidgetAnimationProps,
): RefCallback<Gtk.Widget> => {
    const widgetRef = useRef<Gtk.Widget | null>(null);
    const mergedRef = useMergeRefs(externalRef, widgetRef);

    const isInitialPresence = useIsInitialPresence();
    const animator = useWidgetAnimation(widgetRef, props, isInitialPresence);
    const [isPresent, safeToRemove] = usePresence();

    const exitStartedRef = useRef(false);
    useLayoutEffect(() => {
        if (isPresent || exitStartedRef.current) return;
        exitStartedRef.current = true;
        animator.startAnimation(props.exit ?? {}, () => safeToRemove?.());
    }, [isPresent, props.exit, animator, safeToRemove]);

    return mergedRef;
};
