import type * as Gtk from "@gtkx/gi/gtk";
import { GtkSizeGroup } from "@gtkx/jsx/gtk";
import { useMergedRef } from "@gtkx/react/internal";
import type { ElementType, ReactNode, Ref, RefCallback } from "react";
import { createContext, useCallback, useContext, useState } from "react";
import type { SizeGroupChildProps, SizeGroupProps } from "./types.js";

type Register = RefCallback<Gtk.Widget | null>;

const SizeGroupContext = createContext<Register | null>(null);

type SizeGroupChildRuntimeProps = {
    component: ElementType;
    ref?: Ref<Gtk.Widget | null> | undefined;
} & Record<string, unknown>;

const useRegister = (): Register => {
    const register = useContext(SizeGroupContext);
    if (register === null) throw new Error("<SizeGroup.Child> must be a child of <SizeGroup>");
    return register;
};

const SizeGroupChildImpl = (props: SizeGroupChildRuntimeProps): ReactNode => {
    const { component: Component, ref, ...rest } = props;
    const refCallback = useMergedRef<Gtk.Widget | null>(ref, useRegister());
    return <Component {...rest} ref={refCallback} />;
};

const SizeGroupChild = SizeGroupChildImpl as <C extends ElementType>(props: SizeGroupChildProps<C>) => ReactNode;

const SizeGroupRoot = (props: SizeGroupProps): ReactNode => {
    const { mode, ref, children } = props;
    const [widgets, setWidgets] = useState<Gtk.Widget[]>([]);
    const register = useCallback<Register>((widget) => {
        if (widget === null) return;
        setWidgets((previous) => (previous.includes(widget) ? previous : [...previous, widget]));
        return () => {
            setWidgets((previous) => previous.filter((entry) => entry !== widget));
        };
    }, []);
    return (
        <>
            <GtkSizeGroup ref={ref} mode={mode} widgets={widgets} />
            <SizeGroupContext.Provider value={register}>{children}</SizeGroupContext.Provider>
        </>
    );
};

type SizeGroupComponent = ((props: SizeGroupProps) => ReactNode) & {
    Child: <C extends ElementType>(props: SizeGroupChildProps<C>) => ReactNode;
};

/**
 * Creates a Gtk.SizeGroup that keeps widgets joined through {@link SizeGroup.Child}
 * at a common size in the given mode, without contributing a widget of its own.
 */
export const SizeGroup: SizeGroupComponent = Object.assign(SizeGroupRoot, { Child: SizeGroupChild });
