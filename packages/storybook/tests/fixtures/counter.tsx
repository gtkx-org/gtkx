import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createContext, useContext, useEffect, useState } from "react";

type CounterProps = {
    caption?: string;
    initialCount: number;
    label: string;
    onActivityChange?: (change: number) => void;
    step: number;
};

type DecorationProps = {
    children: ReactNode;
    label: string;
};

const DecorationContext = createContext("");

const Decoration = ({ children, label }: DecorationProps): ReactNode => {
    const parent = useContext(DecorationContext);

    return <DecorationContext value={`${parent}/${label}`}>{children}</DecorationContext>;
};

const Counter = ({ caption, initialCount, label, onActivityChange, step }: CounterProps): ReactNode => {
    const [count, setCount] = useState(initialCount);
    const decoration = useContext(DecorationContext);

    useEffect(() => {
        onActivityChange?.(1);

        return () => {
            onActivityChange?.(-1);
        };
    }, [onActivityChange]);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkButton
                label={label}
                onClicked={() => {
                    setCount((value) => value + step);
                }}
            />
            <GtkLabel name="count">{String(count)}</GtkLabel>
            <GtkLabel name="caption">{caption ?? "No caption"}</GtkLabel>
            <GtkLabel name="decorator-order">{decoration}</GtkLabel>
        </GtkBox>
    );
};

export { Counter, Decoration };
export type { CounterProps };
