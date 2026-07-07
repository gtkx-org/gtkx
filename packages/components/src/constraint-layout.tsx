import type * as Gtk from "@gtkx/gi/gtk";
import { GtkConstraintLayout } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react";
import {
    type Context,
    createContext,
    type ReactNode,
    type Ref,
    type RefObject,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
} from "react";
import {
    applyConstraint,
    applyGuide,
    applyVfl,
    type ConstraintGuideProps,
    type ConstraintProps,
    type ConstraintVflProps,
} from "./constraint-layout-apply.js";

const ORPHAN_MESSAGE = "<ConstraintLayout.Constraint> / <Guide> / <Vfl> must be a child of <ConstraintLayout>";

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

export const ConstraintLayout: ((props: ConstraintLayoutProps) => ReactNode) & {
    Guide: (props: ConstraintGuideProps) => ReactNode;
    Constraint: (props: ConstraintProps) => ReactNode;
    Vfl: (props: ConstraintVflProps) => ReactNode;
} = Object.assign(
    ({ children, ref }: ConstraintLayoutProps): ReactNode => {
        const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);
        const mergedRef = useMergeRefs<Gtk.ConstraintLayout>(ref, layoutRef);
        return (
            <>
                <GtkConstraintLayout ref={mergedRef} />
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
