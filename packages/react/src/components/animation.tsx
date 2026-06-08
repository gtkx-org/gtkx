import type * as Gtk from "@gtkx/gi/gtk";
import { Children, cloneElement, type ReactElement, type ReactNode, type Ref, useLayoutEffect, useRef } from "react";
import type { AdwSpringAnimationProps, AdwTimedAnimationProps } from "../jsx.js";
import { useMergedRefs } from "../use-merged-refs.js";
import { usePresence } from "./animate-presence.js";
import { useWidgetAnimation, type WidgetAnimationProps } from "./use-widget-animation.js";

type WidgetChild = ReactElement<{ ref?: Ref<Gtk.Widget | null> }>;

/**
 * Renders a single widget child and drives a CSS-rendered animation on it.
 *
 * Clones the child with a merged ref so the animation hook reaches the backing
 * widget while the child still attaches to its grandparent through normal
 * reconciliation. When wrapped in an `<AnimatePresence>` and marked as exiting,
 * it plays the `exit` animation and reports completion to the boundary.
 *
 * @param props - The discriminated animation configuration.
 * @returns The cloned child with the animation hook attached.
 */
const WidgetAnimation = (props: WidgetAnimationProps): ReactNode => {
    const { children, exit } = props;
    const widgetRef = useRef<Gtk.Widget | null>(null);
    const child = Children.only(children) as WidgetChild;
    const mergedRef = useMergedRefs(widgetRef, child.props.ref);

    const handle = useWidgetAnimation(widgetRef, props);
    const presence = usePresence();
    const isPresent = presence ? presence.isPresent : true;
    const onExitComplete = presence?.onExitComplete;

    const exitStartedRef = useRef(false);
    useLayoutEffect(() => {
        if (isPresent || exitStartedRef.current) return;
        exitStartedRef.current = true;
        handle.startAnimation(exit ?? {}, () => onExitComplete?.());
    }, [isPresent, exit, handle, onExitComplete]);

    return cloneElement(child, { ref: mergedRef });
};

/**
 * Animates a single child widget over a fixed duration with `Adw.TimedAnimation`.
 *
 * Drives the child's CSS-rendered `opacity` and `transform` from `initial` to
 * `animate`, optionally on mount. Place inside an `<AnimatePresence>` and give
 * it a stable `key` to run the `exit` animation before the child is removed.
 *
 * @example
 * ```tsx
 * <AdwTimedAnimation
 *   initial={{ opacity: 0 }}
 *   animate={{ opacity: 1 }}
 *   duration={300}
 *   animateOnMount
 * >
 *   <GtkLabel label="Fade in" />
 * </AdwTimedAnimation>
 * ```
 *
 * @param props - {@link AdwTimedAnimationProps} plus the single widget child.
 * @returns The animated child widget.
 */
export const AdwTimedAnimation = (props: AdwTimedAnimationProps): ReactNode => (
    <WidgetAnimation kind="timed" {...props} />
);

/**
 * Animates a single child widget with spring physics via `Adw.SpringAnimation`.
 *
 * Drives the child's CSS-rendered `opacity` and `transform` from `initial` to
 * `animate`, optionally on mount. Place inside an `<AnimatePresence>` and give
 * it a stable `key` to run the `exit` animation before the child is removed.
 *
 * @example
 * ```tsx
 * <AdwSpringAnimation
 *   initial={{ scale: 0.9, opacity: 0 }}
 *   animate={{ scale: 1, opacity: 1 }}
 *   damping={0.8}
 *   stiffness={200}
 *   animateOnMount
 * >
 *   <GtkButton label="Spring in" />
 * </AdwSpringAnimation>
 * ```
 *
 * @param props - {@link AdwSpringAnimationProps} plus the single widget child.
 * @returns The animated child widget.
 */
export const AdwSpringAnimation = (props: AdwSpringAnimationProps): ReactNode => (
    <WidgetAnimation kind="spring" {...props} />
);
