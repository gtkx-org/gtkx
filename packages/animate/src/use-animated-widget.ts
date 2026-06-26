import type * as Gtk from "@gtkx/gi/gtk";
import { useMergeRefs } from "@gtkx/react";
import { type Ref, type RefCallback, useLayoutEffect, useRef } from "react";
import { useIsInitialPresence, usePresence } from "./animate-presence.js";
import type { WidgetAnimationProps } from "./types.js";
import { useWidgetAnimation } from "./use-widget-animation.js";

/**
 * Drives the enter and exit animation for a single GTK widget and returns the
 * ref to attach to it.
 *
 * The returned ref merges the supplied external ref with the animator's own
 * ref. On mount the enter animation plays (gated by {@link AnimatePresence}'s
 * initial-presence state); when the element is removed from an
 * {@link AnimatePresence}, the exit animation runs and presence completion is
 * signalled once it settles.
 *
 * @param externalRef - A caller-supplied ref to also receive the widget.
 * @param props - The {@link WidgetAnimationProps} describing the animation.
 * @returns A ref callback to attach to the animated widget.
 */
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
