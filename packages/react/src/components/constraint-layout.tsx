import type * as Gtk from "@gtkx/gi/gtk";
import {
    type Context,
    createContext,
    createElement,
    type ReactNode,
    type Ref,
    type RefObject,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
} from "react";
import { useForwardedRef } from "../hooks/use-forwarded-ref.js";
import type { ConstraintGuideProps, ConstraintProps, ConstraintVflProps } from "../utils/element-props.js";
import { applyConstraint, applyGuide, applyVfl } from "./constraint-layout-apply.js";

const GtkConstraintLayoutElement = "GtkConstraintLayout" as const;

const ORPHAN_MESSAGE = "<GtkConstraintLayout.Constraint> / <Guide> / <Vfl> must be a child of <GtkConstraintLayout>";

/**
 * Context carrying a ref to the live `Gtk.ConstraintLayout` from a
 * `<GtkConstraintLayout>` provider down to its `<Constraint>`, `<Vfl>`, and
 * `<Guide>` children. A `null` value means the marker is not enclosed by a
 * provider.
 */
const ConstraintLayoutContext: Context<RefObject<Gtk.ConstraintLayout | null> | null> =
    createContext<RefObject<Gtk.ConstraintLayout | null> | null>(null);

/**
 * Reads the enclosing {@link ConstraintLayoutContext}, throwing when a marker is
 * used outside a `<GtkConstraintLayout>`.
 */
const useConstraintLayoutRef = (): RefObject<Gtk.ConstraintLayout | null> => {
    const ref = useContext(ConstraintLayoutContext);
    if (!ref) throw new Error(ORPHAN_MESSAGE);
    return ref;
};

/**
 * Props for the `GtkConstraintLayout` declarative wrapper: the solver markers
 * as children plus an optional ref to the live layout manager.
 */
export type ConstraintLayoutProps = {
    /** The `Constraint`/`Guide`/`Vfl` markers declaring the solver. */
    children?: ReactNode;
    /** Ref to the live `Gtk.ConstraintLayout`. */
    ref?: Ref<Gtk.ConstraintLayout | null>;
};

type ContributionCleanupRef = { current: (() => void) | null };

const cleanupContribution = (cleanupRef: ContributionCleanupRef): void => {
    const cleanup = cleanupRef.current;
    if (!cleanup) return;
    cleanupRef.current = null;
    cleanup();
};

/**
 * Adds a `<Guide>`'s contribution to the enclosing layout from a layout effect,
 * re-applying it when `deps` change and removing it on cleanup. A layout effect
 * runs before any `<Constraint>`/`<Vfl>` passive effect of the same commit, so
 * the registered guide is present before those markers resolve ids against it.
 *
 * @param apply - Adds the contribution and returns its remover.
 * @param deps - Marker props whose change re-applies the contribution.
 */
const useLayoutContribution = (apply: (layout: Gtk.ConstraintLayout) => () => void, deps: readonly unknown[]): void => {
    const layoutRef = useConstraintLayoutRef();
    useLayoutEffect(() => {
        const layout = layoutRef.current;
        if (!layout) return;
        return apply(layout);
    }, deps);
};

/**
 * Adds a `<Constraint>`/`<Vfl>` contribution, deferring application to a passive
 * effect so every `<Widget>`/`<Guide>` layout-effect registration of the same
 * commit has settled before its ids are resolved, while tearing the previous
 * contribution down in the layout phase before any re-registration disturbs the
 * id map.
 *
 * @param apply - Adds the contribution and returns its remover.
 * @param deps - Marker props whose change re-applies the contribution.
 */
const useDeferredContribution = (
    apply: (layout: Gtk.ConstraintLayout) => () => void,
    deps: readonly unknown[],
): void => {
    const layoutRef = useConstraintLayoutRef();
    const cleanupRef = useRef<(() => void) | null>(null);

    useLayoutEffect(() => () => cleanupContribution(cleanupRef), deps);

    useEffect(() => {
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
 * The layout manager is passed through the host widget's `layoutManager` prop,
 * and its live instance is shared with the sub-components that declare the
 * solver:
 *
 * - A participating widget declares its id through its own `name` prop
 *   (e.g. `<GtkLabel name="a" />`) and renders as a regular child of the host.
 * - `<GtkConstraintLayout.Guide id>` adds a spacer `Gtk.ConstraintGuide`,
 *   registered under `id`.
 * - `<GtkConstraintLayout.Constraint>` declares one solver row, resolving its
 *   `target`/`source` ids to the host's named children and the layout's guides.
 * - `<GtkConstraintLayout.Vfl>` parses a Visual Format Language description.
 *
 * @example
 * ```tsx
 * <GtkBox
 *   layoutManager={
 *     <GtkConstraintLayout>
 *       <GtkConstraintLayout.Constraint target="a" targetAttribute={A.WIDTH} source="b" sourceAttribute={A.WIDTH} />
 *     </GtkConstraintLayout>
 *   }
 * >
 *   <GtkLabel name="a" label="A" />
 *   <GtkLabel name="b" label="B" />
 * </GtkBox>
 * ```
 */
export const GtkConstraintLayout: ((props: ConstraintLayoutProps) => ReactNode) & {
    /**
     * Adds a `Gtk.ConstraintGuide` spacer to the layout, registered under `id`
     * (the guide's `name`), with optional min/nat/max sizes and strength.
     */
    Guide: (props: ConstraintGuideProps) => ReactNode;
    /**
     * Declares one solver row. `target`/`source` reference the `name` of a
     * host child or a `<Guide>` id, or `"super"` / omitted for the
     * layout-owning widget.
     */
    Constraint: (props: ConstraintProps) => ReactNode;
    /** Parses a Visual Format Language description into solver rows. */
    Vfl: (props: ConstraintVflProps) => ReactNode;
} = Object.assign(
    ({ children, ref }: ConstraintLayoutProps): ReactNode => {
        const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);
        const captureLayout = useCallback(
            (layout: Gtk.ConstraintLayout | null): void => {
                layoutRef.current = layout;
            },
            [layoutRef],
        );
        const [, mergedRef] = useForwardedRef<Gtk.ConstraintLayout>(ref, captureLayout);
        return (
            <>
                {createElement(GtkConstraintLayoutElement, { ref: mergedRef })}
                <ConstraintLayoutContext.Provider value={layoutRef}>{children}</ConstraintLayoutContext.Provider>
            </>
        );
    },
    {
        Guide: (props: ConstraintGuideProps): ReactNode => {
            useLayoutContribution(
                (layout) => applyGuide(layout, props),
                [
                    props.id,
                    props.minWidth,
                    props.minHeight,
                    props.natWidth,
                    props.natHeight,
                    props.maxWidth,
                    props.maxHeight,
                    props.strength,
                ],
            );
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
