import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, type GtkBoxProps, GtkConstraintLayout } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { ConstraintChildButtons } from "./child-buttons.js";

const A = Gtk.ConstraintAttribute;

/**
 * Pins `button1` to the top edge of the container with the standard 8px inset
 * shared by the constraint demos.
 */
export const TopEdgeConstraint = (): ReactNode => (
    <GtkConstraintLayout.Constraint target="button1" targetAttribute={A.TOP} sourceAttribute={A.TOP} constant={8} />
);

/**
 * Pins `button3` to the bottom edge of the container with the standard 8px
 * inset shared by the constraint demos.
 */
export const BottomEdgeConstraint = (): ReactNode => (
    <GtkConstraintLayout.Constraint
        target="button3"
        targetAttribute={A.BOTTOM}
        sourceAttribute={A.BOTTOM}
        constant={-8}
    />
);

/**
 * Renders the shared container scaffold for the constraint demos: an expanding
 * `GtkBox` driven by the given constraint `layoutManager`, holding the three
 * child buttons that every demo lays out. Extra `controllers` are attached when
 * supplied.
 */
export const ConstraintContainer = ({
    layoutManager,
    controllers,
}: {
    layoutManager: GtkBoxProps["layoutManager"];
    controllers?: GtkBoxProps["addController"];
}): ReactNode => (
    <GtkBox name="container" hexpand vexpand layoutManager={layoutManager} addController={controllers}>
        <ConstraintChildButtons />
    </GtkBox>
);
