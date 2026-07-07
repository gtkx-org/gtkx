import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkFixed, type GtkFixedProps } from "@gtkx/jsx/gtk";
import { useMergeRefs } from "@gtkx/react";
import {
    createContext,
    createElement,
    type ReactNode,
    type Ref,
    type RefCallback,
    useCallback,
    useContext,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

const FixedContext = createContext<Gtk.Fixed | null | undefined>(undefined);

const useFixedInstance = (): Gtk.Fixed | null => {
    const fixed = useContext(FixedContext);
    if (fixed === undefined) throw new Error("<Fixed.Child> must be a child of <Fixed>");
    return fixed;
};

/**
 * Props for {@link Fixed}. Forwards every {@link Gtk.Fixed} widget prop. Wrap
 * positioned children in {@link Fixed.Child}; any other child (such as a
 * floating {@link Gtk.Popover}) is parented to the fixed without a position.
 */
export type FixedProps = GtkFixedProps & { ref?: Ref<Gtk.Fixed | null>; children?: ReactNode };

/**
 * Props for {@link Fixed.Child}. Its content, rendered through the child
 * function and wired to the passed ref, is pinned at pixel coordinates
 * (`x`, `y`); passing `transform` instead applies an arbitrary
 * {@link Gsk.Transform}.
 */
export type FixedChildProps = {
    children: (ref: RefCallback<Gtk.Widget>) => ReactNode;
    x?: number | null | undefined;
    y?: number | null | undefined;
    transform?: Gsk.Transform | null | undefined;
};

const transformOf = (props: FixedChildProps): Gsk.Transform | null =>
    props.transform !== undefined
        ? props.transform
        : Gsk.Transform.new().translate(Graphene.Point.create(props.x ?? 0, props.y ?? 0));

const FixedChild = (props: FixedChildProps): ReactNode => {
    const fixed = useFixedInstance();
    const widgetRef = useRef<Gtk.Widget | null>(null);
    const setWidget = useCallback<RefCallback<Gtk.Widget>>((node) => {
        widgetRef.current = node;
    }, []);

    useLayoutEffect(() => {
        const widget = widgetRef.current;
        if (widget && fixed) fixed.setChildTransform(widget, transformOf(props));
    }, [fixed, props.x, props.y, props.transform]);

    return props.children(setWidget);
};

/**
 * Declarative wrapper over {@link Gtk.Fixed}. Children are parented to the fixed
 * by the reconciler; each {@link Fixed.Child} then positions its widget through
 * its `GtkFixedLayoutChild` transform, while any other child (e.g. a
 * `GtkPopover`) is left floating at the origin.
 */
export const Fixed: ((props: FixedProps) => ReactNode) & { Child: (props: FixedChildProps) => ReactNode } =
    Object.assign(
        ({ children, ref, ...rest }: FixedProps): ReactNode => {
            const [fixed, setFixed] = useState<Gtk.Fixed | null>(null);
            const mergedRef = useMergeRefs<Gtk.Fixed>(ref, setFixed);
            return createElement(
                GtkFixed,
                { ...rest, ref: mergedRef },
                createElement(FixedContext.Provider, { value: fixed }, children),
            );
        },
        { Child: FixedChild },
    );
