import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkFixed, type GtkFixedProps } from "@gtkx/jsx/gtk";
import { useMergedRef } from "@gtkx/react/internal";
import {
    createContext,
    type ElementType,
    type ReactNode,
    type Ref,
    type RefCallback,
    useCallback,
    useContext,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import type { ChildProps } from "./types.js";

const FixedContext = createContext<Gtk.Fixed | null | undefined>(undefined);

const useFixedInstance = (): Gtk.Fixed | null => {
    const fixed = useContext(FixedContext);
    if (fixed === undefined) throw new Error("<Fixed.Child> must be a child of <Fixed>");
    return fixed;
};

/** Props for {@link Fixed}. */
export type FixedProps = GtkFixedProps & { ref?: Ref<Gtk.Fixed | null>; children?: ReactNode };

export type FixedPlacementProps = {
    x?: number | null | undefined;
    y?: number | null | undefined;
    /** Full transform applied to the child, overriding x and y when provided. */
    transform?: Gsk.Transform | null | undefined;
};

/** Positions a single child inside a {@link Fixed} at coordinates x and y, or by an explicit transform. */
export type FixedChildProps<C extends ElementType> = ChildProps<C, FixedPlacementProps>;

const transformOf = (x: number, y: number, transform: Gsk.Transform | null | undefined): Gsk.Transform | null =>
    transform !== undefined ? transform : Gsk.Transform.new().translate(Graphene.Point.create(x, y));

const FixedChild = <C extends ElementType>({
    component,
    x,
    y,
    transform,
    ref,
    ...rest
}: FixedChildProps<C>): ReactNode => {
    const fixed = useFixedInstance();
    const Component: ElementType = component;
    const widgetRef = useRef<Gtk.Widget | null>(null);
    const captureWidget = useCallback<RefCallback<Gtk.Widget>>((node) => {
        widgetRef.current = node;
    }, []);
    const setWidget = useMergedRef<Gtk.Widget>(ref, captureWidget);

    useLayoutEffect(() => {
        const widget = widgetRef.current;
        if (widget === null || fixed === null) return;
        fixed.setChildTransform(widget, transformOf(x ?? 0, y ?? 0, transform));
    });

    return <Component {...rest} ref={setWidget} />;
};

/**
 * Renders a Gtk.Fixed container whose children are placed at explicit positions via
 * {@link Fixed.Child}.
 */
export const Fixed: ((props: FixedProps) => ReactNode) & {
    Child: <C extends ElementType>(props: FixedChildProps<C>) => ReactNode;
} = Object.assign(
    ({ children, ref, ...rest }: FixedProps): ReactNode => {
        const [fixed, setFixed] = useState<Gtk.Fixed | null>(null);
        const mergedRef = useMergedRef<Gtk.Fixed>(ref, setFixed);
        return (
            <GtkFixed {...rest} ref={mergedRef}>
                <FixedContext.Provider value={fixed}>{children}</FixedContext.Provider>
            </GtkFixed>
        );
    },
    { Child: FixedChild },
);
