import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useMemo, useState } from "react";

type ChildButtons = {
    button1: Gtk.Button;
    button2: Gtk.Button;
    button3: Gtk.Button;
};

type ChildButtonHandlers = {
    onButton1: (button: Gtk.Button | null) => void;
    onButton2: (button: Gtk.Button | null) => void;
    onButton3: (button: Gtk.Button | null) => void;
};

const useChildButtons = (): [ChildButtons | null, ChildButtonHandlers] => {
    const [button1, setButton1] = useState<Gtk.Button | null>(null);
    const [button2, setButton2] = useState<Gtk.Button | null>(null);
    const [button3, setButton3] = useState<Gtk.Button | null>(null);

    const buttons = useMemo(
        () => (button1 === null || button2 === null || button3 === null ? null : { button1, button2, button3 }),
        [button1, button2, button3],
    );

    const handlers = useMemo(() => ({ onButton1: setButton1, onButton2: setButton2, onButton3: setButton3 }), []);

    return [buttons, handlers];
};

const ConstraintChildButtons = ({ onButton1, onButton2, onButton3 }: ChildButtonHandlers): ReactNode => (
    <>
        <GtkButton ref={onButton1} name="button1" label="Child 1" />
        <GtkButton ref={onButton2} name="button2" label="Child 2" />
        <GtkButton ref={onButton3} name="button3" label="Child 3" />
    </>
);

export { type ChildButtonHandlers, type ChildButtons, ConstraintChildButtons, useChildButtons };
