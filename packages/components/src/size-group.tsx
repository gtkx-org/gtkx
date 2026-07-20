import type * as Gtk from "@gtkx/gi/gtk";
import { GtkSizeGroup } from "@gtkx/jsx/gtk";
import { useMergedRef } from "@gtkx/react/internal";
import {
    createContext,
    type ElementType,
    type ReactNode,
    type Ref,
    type RefCallback,
    useCallback,
    useContext,
    useRef,
} from "react";
import type { ChildProps } from "./types.js";

type SizeGroupRegistry = {
    addWidget: (widget: Gtk.Widget) => void;
    removeWidget: (widget: Gtk.Widget) => void;
    setGroup: (group: Gtk.SizeGroup | null) => void;
};

const SizeGroupContext = createContext<SizeGroupRegistry | null>(null);

const useSizeGroupRegistry = (): SizeGroupRegistry => {
    const registry = useContext(SizeGroupContext);
    if (!registry) throw new Error("<SizeGroup.Child> must be a child of <SizeGroup>");
    return registry;
};

/** Props for {@link SizeGroup}. */
export type SizeGroupProps = {
    /** How the group equalizes sizes: horizontal, vertical, or both. */
    mode?: Gtk.SizeGroupMode | null | undefined;
    ref?: Ref<Gtk.SizeGroup | null>;
    children?: ReactNode;
};

/** Adds a single widget, rendered by the given component, to the enclosing {@link SizeGroup}. */
export type SizeGroupChildProps<C extends ElementType> = ChildProps<C>;

const SizeGroupChild = <C extends ElementType>({ component, ref, ...rest }: SizeGroupChildProps<C>): ReactNode => {
    const registry = useSizeGroupRegistry();
    const joinGroup = useCallback<RefCallback<Gtk.Widget>>(
        (widget) => {
            if (widget === null) return;
            registry.addWidget(widget);
            return () => registry.removeWidget(widget);
        },
        [registry],
    );
    const Component: ElementType = component;
    const setWidget = useMergedRef<Gtk.Widget>(ref, joinGroup);
    return <Component {...rest} ref={setWidget} />;
};

const createRegistry = (): SizeGroupRegistry => {
    const members = new Set<Gtk.Widget>();
    let group: Gtk.SizeGroup | null = null;
    return {
        addWidget: (widget) => {
            members.add(widget);
            group?.addWidget(widget);
        },
        removeWidget: (widget) => {
            members.delete(widget);
            group?.removeWidget(widget);
        },
        setGroup: (next) => {
            group = next;
            if (next) for (const member of members) next.addWidget(member);
        },
    };
};

/**
 * Creates a Gtk.SizeGroup that keeps its member widgets at a common size. Members join the group
 * through {@link SizeGroup.Child}.
 */
export const SizeGroup: ((props: SizeGroupProps) => ReactNode) & {
    Child: <C extends ElementType>(props: SizeGroupChildProps<C>) => ReactNode;
} = Object.assign(
    ({ mode, ref, children }: SizeGroupProps): ReactNode => {
        const registryRef = useRef<SizeGroupRegistry | null>(null);
        if (registryRef.current === null) registryRef.current = createRegistry();
        const registry = registryRef.current;
        const setGroup = useCallback<RefCallback<Gtk.SizeGroup>>((group) => registry.setGroup(group), [registry]);
        const mergedRef = useMergedRef<Gtk.SizeGroup>(ref, setGroup);
        return (
            <>
                <GtkSizeGroup ref={mergedRef} mode={mode} />
                <SizeGroupContext.Provider value={registry}>{children}</SizeGroupContext.Provider>
            </>
        );
    },
    { Child: SizeGroupChild },
);
