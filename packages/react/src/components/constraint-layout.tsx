import * as Gtk from "@gtkx/gi/gtk";
import type { GtkConstraintLayoutProps } from "@gtkx/jsx/gtk";
import {
    Children,
    cloneElement,
    type EffectCallback,
    type ReactNode,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
} from "react";
import type { ConstraintGuideProps, ConstraintLayoutWidgetProps, ConstraintProps, ConstraintVflProps } from "../jsx.js";
import { registerConstraintTarget, unregisterConstraintTarget } from "../nodes/internal/constraint-target-registry.js";
import {
    applyConstraint,
    applyGuide,
    applyVfl,
    ConstraintLayoutContext,
    useConstraintLayout,
    useConstraintLayoutRef,
} from "../use-constraint-layout.js";
import { assignRef } from "../use-merged-refs.js";
import { useChildWidgetRegistration, type WidgetChild } from "./internal/use-child-widget-registration.js";

const GtkConstraintLayoutElement = "GtkConstraintLayout" as const;

const MISSING_LAYOUT_MESSAGE =
    "<GtkConstraintLayout.Widget> must be a sibling of <GtkConstraintLayout> under the same widget parent";

const layoutOf = (widget: Gtk.Widget): Gtk.ConstraintLayout | null => {
    const layout = widget.getParent()?.getLayoutManager();
    return layout instanceof Gtk.ConstraintLayout ? layout : null;
};

/**
 * Registers a `<GtkConstraintLayout.Widget>`'s single child with the constraint
 * layout installed on the wrapper's grandparent.
 *
 * The child's widget is captured through a callback ref merged with any ref the
 * child already carries, then registered under `id` from a layout effect and
 * unregistered on cleanup. Throws when the grandparent host has no constraint
 * layout, mirroring the requirement that the marker be a sibling of a
 * `<GtkConstraintLayout>`.
 *
 * @param id - The id the wrapped widget is registered under.
 * @param child - The single widget element to register.
 */
const ConstraintLayoutMember = ({ id, child }: { id: string; child: WidgetChild }): ReactNode => {
    const register = useCallback(
        (widget: Gtk.Widget) => {
            const layout = layoutOf(widget);
            if (!layout) throw new Error(MISSING_LAYOUT_MESSAGE);
            registerConstraintTarget(layout, id, widget);
            return () => unregisterConstraintTarget(layout, id);
        },
        [id],
    );
    const captureWidget = useChildWidgetRegistration(child, register);

    return cloneElement(child, { ref: captureWidget });
};

/** A React effect hook with the `useEffect`/`useLayoutEffect` call signature. */
type EffectHook = (effect: EffectCallback, deps: readonly unknown[]) => void;
type ContributionCleanupRef = { current: (() => void) | null };

const cleanupContribution = (cleanupRef: ContributionCleanupRef): void => {
    const cleanup = cleanupRef.current;
    if (!cleanup) return;
    cleanupRef.current = null;
    cleanup();
};

/**
 * Runs `apply` against the enclosing layout through `useEffectHook`, re-applying
 * it when `deps` change and removing it on cleanup.
 *
 * Markers that register targets (`<Guide>`) use a layout effect so the target is
 * present before dependents resolve; markers that resolve ids (`<Constraint>`,
 * `<Vfl>`) use a passive effect, which runs after every `<Widget>`/`<Guide>`
 * layout effect of the same commit has registered.
 *
 * @param useEffectHook - The effect hook to drive the contribution.
 * @param apply - Adds the contribution and returns its remover.
 * @param deps - Marker props whose change re-applies the contribution.
 */
const useContribution = (
    useEffectHook: EffectHook,
    apply: (layout: Gtk.ConstraintLayout) => () => void,
    deps: readonly unknown[],
): void => {
    const layoutRef = useConstraintLayoutRef();
    useEffectHook(() => {
        const layout = layoutRef.current;
        if (!layout) return;
        return apply(layout);
    }, deps);
};

const useDeferredContribution = (
    apply: (layout: Gtk.ConstraintLayout) => () => void,
    deps: readonly unknown[],
): void => {
    const layoutRef = useConstraintLayoutRef();
    const cleanupRef = useRef<(() => void) | null>(null);
    const onCommitCleanup: EffectHook = useLayoutEffect;
    const onPassiveApply: EffectHook = useEffect;

    onCommitCleanup(() => () => cleanupContribution(cleanupRef), deps);

    onPassiveApply(() => {
        const layout = layoutRef.current;
        if (!layout) return;
        const cleanup = apply(layout);
        cleanupRef.current = cleanup;
        return () => {
            if (cleanupRef.current === cleanup) cleanupContribution(cleanupRef);
        };
    }, deps);
};

/**
 * Declarative wrapper for `Gtk.ConstraintLayout`.
 *
 * The layout manager installs itself on the host widget through the generic
 * non-widget self-attach path, and its live instance is shared with the
 * sub-components that declare the solver:
 *
 * - `<GtkConstraintLayout.Widget id>` wraps a single widget transparently (it
 *   appears in the GTK tree at the wrapper's grandparent) and registers the
 *   widget under `id` so constraints can reference it.
 * - `<GtkConstraintLayout.Guide id>` adds a spacer `Gtk.ConstraintGuide`,
 *   registered under `id`.
 * - `<GtkConstraintLayout.Constraint>` declares one solver row, resolving its
 *   `target`/`source` ids to the registered widgets and guides.
 * - `<GtkConstraintLayout.Vfl>` parses a Visual Format Language description.
 *
 * @example
 * ```tsx
 * <GtkBox>
 *   <GtkConstraintLayout>
 *     <GtkConstraintLayout.Constraint target="a" targetAttribute={A.WIDTH} source="b" sourceAttribute={A.WIDTH} />
 *   </GtkConstraintLayout>
 *   <GtkConstraintLayout.Widget id="a"><GtkLabel label="A" /></GtkConstraintLayout.Widget>
 *   <GtkConstraintLayout.Widget id="b"><GtkLabel label="B" /></GtkConstraintLayout.Widget>
 * </GtkBox>
 * ```
 */
export const GtkConstraintLayout: ((props: GtkConstraintLayoutProps) => ReactNode) & {
    /**
     * Wraps a single widget that participates in constraints, registering it
     * under `id`. Transparent in the GTK tree: the widget attaches to the
     * wrapper's grandparent (the host that owns the layout).
     */
    Widget: (props: ConstraintLayoutWidgetProps) => ReactNode;
    /**
     * Adds a `Gtk.ConstraintGuide` spacer to the layout, registered under `id`
     * (the guide's `name`), with optional min/nat/max sizes and strength.
     */
    Guide: (props: ConstraintGuideProps) => ReactNode;
    /**
     * Declares one solver row. `target`/`source` reference ids registered by
     * sibling `<Widget>`/`<Guide>` markers, or `"super"` / omitted for the
     * layout-owning widget.
     */
    Constraint: (props: ConstraintProps) => ReactNode;
    /** Parses a Visual Format Language description into solver rows. */
    Vfl: (props: ConstraintVflProps) => ReactNode;
} = Object.assign(
    ({ children, ref, ...rest }: GtkConstraintLayoutProps): ReactNode => {
        const layoutRef = useConstraintLayout();
        const mergedRef = (layout: Gtk.ConstraintLayout | null): void => {
            layoutRef.current = layout;
            assignRef(ref, layout);
        };
        return (
            <>
                <GtkConstraintLayoutElement ref={mergedRef} {...rest} />
                <ConstraintLayoutContext.Provider value={layoutRef}>{children}</ConstraintLayoutContext.Provider>
            </>
        );
    },
    {
        Widget: (props: ConstraintLayoutWidgetProps): ReactNode => {
            const child = Children.only(props.children) as WidgetChild;
            return <ConstraintLayoutMember id={props.id} child={child} />;
        },
        Guide: (props: ConstraintGuideProps): ReactNode => {
            useContribution(useLayoutEffect, (layout) => applyGuide(layout, props), [
                props.id,
                props.minWidth,
                props.minHeight,
                props.natWidth,
                props.natHeight,
                props.maxWidth,
                props.maxHeight,
                props.strength,
            ]);
            return null;
        },
        Constraint: (props: ConstraintProps): ReactNode => {
            useDeferredContribution(
                (layout) => applyConstraint(layout, props),
                [
                    props.target,
                    props.targetAttribute,
                    props.relation,
                    props.source,
                    props.sourceAttribute,
                    props.multiplier,
                    props.constant,
                    props.strength,
                ],
            );
            return null;
        },
        Vfl: (props: ConstraintVflProps): ReactNode => {
            useDeferredContribution((layout) => applyVfl(layout, props), [props.lines, props.hspacing, props.vspacing]);
            return null;
        },
    },
);
