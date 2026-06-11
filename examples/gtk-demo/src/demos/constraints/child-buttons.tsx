import { GtkButton, GtkConstraintLayout } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";

/**
 * The three constraint-laid-out child buttons shared by the constraints demos.
 */
export const ConstraintChildButtons = (): ReactNode => (
    <>
        <GtkConstraintLayout.Widget id="button1">
            <GtkButton name="button1" label="Child 1" />
        </GtkConstraintLayout.Widget>
        <GtkConstraintLayout.Widget id="button2">
            <GtkButton name="button2" label="Child 2" />
        </GtkConstraintLayout.Widget>
        <GtkConstraintLayout.Widget id="button3">
            <GtkButton name="button3" label="Child 3" />
        </GtkConstraintLayout.Widget>
    </>
);
