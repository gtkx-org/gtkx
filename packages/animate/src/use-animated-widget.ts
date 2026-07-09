import type * as Gtk from "@gtkx/gi/gtk";
import { useMergeRefs } from "@gtkx/react/internal";
import { isShallowEqual } from "@gtkx/utils";
import { type Ref, type RefCallback, useId, useLayoutEffect, useRef } from "react";
import { useIsInitialPresence, usePresence } from "./animate-presence.js";
import type { AnimationProps, AnimationTarget } from "./animation-types.js";
import { WidgetAnimator } from "./widget-animator.js";

const sanitizeId = (id: string): string => `gtkx-anim-${id.replace(/[^a-zA-Z0-9]/g, "")}`;

export const useAnimatedWidget = (
    externalRef: Ref<Gtk.Widget | null> | undefined,
    props: AnimationProps,
): RefCallback<Gtk.Widget> => {
    const widgetRef = useRef<Gtk.Widget | null>(null);
    const mergedRef = useMergeRefs(externalRef, widgetRef);

    const isInitialPresence = useIsInitialPresence();

    const className = sanitizeId(useId());
    const propsRef = useRef(props);
    propsRef.current = props;

    const animateOnMountRef = useRef(isInitialPresence);
    animateOnMountRef.current = isInitialPresence;

    const animatorRef = useRef<WidgetAnimator | null>(null);
    if (!animatorRef.current) {
        animatorRef.current = new WidgetAnimator(className, widgetRef, propsRef);
    }
    const animator = animatorRef.current;

    useLayoutEffect(() => {
        animator.applyMount(animateOnMountRef.current);
        return () => animator.dispose();
    }, [animator]);

    const previousAnimateRef = useRef<AnimationTarget | undefined>(props.animate);
    useLayoutEffect(() => {
        const previous = previousAnimateRef.current;
        previousAnimateRef.current = props.animate;

        if (!widgetRef.current || !props.animate) return;
        if (isShallowEqual(previous, props.animate)) return;

        animator.startAnimation(props.animate);
    }, [animator, props.animate]);

    const [isPresent, safeToRemove] = usePresence();

    const exitStartedRef = useRef(false);
    const wasPresentRef = useRef(isPresent);
    useLayoutEffect(() => {
        const wasPresent = wasPresentRef.current;
        wasPresentRef.current = isPresent;

        if (!isPresent) {
            if (exitStartedRef.current) return;
            exitStartedRef.current = true;
            animator.startAnimation(props.exit ?? {}, () => safeToRemove());
            return;
        }

        if (wasPresent || !exitStartedRef.current) return;
        exitStartedRef.current = false;
        if (props.animate) animator.startAnimation(props.animate);
    }, [isPresent, props.exit, props.animate, animator, safeToRemove]);

    return mergedRef;
};
