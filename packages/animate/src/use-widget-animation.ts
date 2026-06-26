import type * as Gtk from "@gtkx/gi/gtk";
import { shallowEqual } from "@gtkx/utils";
import { type RefObject, useId, useLayoutEffect, useRef } from "react";
import type { AnimationTarget, WidgetAnimationProps } from "./types.js";
import { WidgetAnimator } from "./widget-animator.js";

const sanitizeId = (id: string): string => `gtkx-anim-${id.replace(/[^a-zA-Z0-9]/g, "")}`;

/**
 * React hook that drives imperative widget animations for a single GTK widget.
 *
 * It creates and owns a stable {@link WidgetAnimator}, plays the enter
 * animation on mount, animates toward each new `animate` target as props
 * change, and disposes the animator on unmount. The returned animator can be
 * used to trigger ad-hoc transitions (for example an exit animation).
 *
 * @param ref - Ref to the widget to animate.
 * @param props - The {@link WidgetAnimationProps} describing the animation.
 * @param animateOnMount - Whether to play the enter animation on mount; defaults to `true`.
 * @returns The {@link WidgetAnimator} bound to the widget.
 */
export const useWidgetAnimation = (
    ref: RefObject<Gtk.Widget | null>,
    props: WidgetAnimationProps,
    animateOnMount = true,
): WidgetAnimator => {
    const className = sanitizeId(useId());
    const propsRef = useRef(props);
    propsRef.current = props;

    const animateOnMountRef = useRef(animateOnMount);
    animateOnMountRef.current = animateOnMount;

    const animatorRef = useRef<WidgetAnimator | null>(null);
    if (!animatorRef.current) {
        animatorRef.current = new WidgetAnimator(className, ref, propsRef);
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

        if (!ref.current || !props.animate) return;
        if (shallowEqual(previous, props.animate)) return;

        animator.startAnimation(props.animate);
    }, [ref, animator, props.animate]);

    return animator;
};
