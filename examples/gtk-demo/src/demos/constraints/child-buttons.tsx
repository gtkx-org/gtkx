import { GtkButton } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";

export const ConstraintChildButtons = (): ReactNode => (
    <>
        <GtkButton name="button1" label="Child 1" />
        <GtkButton name="button2" label="Child 2" />
        <GtkButton name="button3" label="Child 3" />
    </>
);
