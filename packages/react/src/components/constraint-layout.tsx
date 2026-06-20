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

const ConstraintLayoutContext: Context<RefObject<Gtk.ConstraintLayout | null> | null> =
    createContext<RefObject<Gtk.ConstraintLayout | null> | null>(null);

const useConstraintLayoutRef = (): RefObject<Gtk.ConstraintLayout | null> => {
    const ref = useContext(ConstraintLayoutContext);
    if (!ref) throw new Error(ORPHAN_MESSAGE);
    return ref;
};

export type ConstraintLayoutProps = {
    children?: ReactNode;
    ref?: Ref<Gtk.ConstraintLayout | null>;
};

type ContributionCleanupRef = { current: (() => void) | null };

const cleanupContribution = (cleanupRef: ContributionCleanupRef): void => {
    const cleanup = cleanupRef.current;
    if (!cleanup) return;
    cleanupRef.current = null;
    cleanup();
};

const useLayoutContribution = (apply: (layout: Gtk.ConstraintLayout) => () => void, deps: unknown[]): void => {
    const layoutRef = useConstraintLayoutRef();
    useLayoutEffect(() => {
        const layout = layoutRef.current;
        if (!layout) return;
        return apply(layout);
    }, deps);
};

const useDeferredContribution = (apply: (layout: Gtk.ConstraintLayout) => () => void, deps: unknown[]): void => {
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

export const GtkConstraintLayout: ((props: ConstraintLayoutProps) => ReactNode) & {
    Guide: (props: ConstraintGuideProps) => ReactNode;
    Constraint: (props: ConstraintProps) => ReactNode;
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
