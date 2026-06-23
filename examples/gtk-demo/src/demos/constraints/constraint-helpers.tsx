import { ConstraintLayout } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, type GtkBoxProps } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { ConstraintChildButtons } from "./child-buttons.js";

const A = Gtk.ConstraintAttribute;

export const TopEdgeConstraint = (): ReactNode => (
    <ConstraintLayout.Constraint target="button1" targetAttribute={A.TOP} sourceAttribute={A.TOP} constant={8} />
);

export const BottomEdgeConstraint = (): ReactNode => (
    <ConstraintLayout.Constraint target="button3" targetAttribute={A.BOTTOM} sourceAttribute={A.BOTTOM} constant={-8} />
);

export const ConstraintContainer = ({
    layoutManager,
    controllers,
}: {
    layoutManager: GtkBoxProps["layoutManager"];
    controllers?: GtkBoxProps["controllers"];
}): ReactNode => (
    <GtkBox name="container" hexpand vexpand layoutManager={layoutManager} controllers={controllers}>
        <ConstraintChildButtons />
    </GtkBox>
);
