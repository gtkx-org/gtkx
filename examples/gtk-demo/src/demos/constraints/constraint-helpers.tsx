import type { ReactNode } from "react";
import { ConstraintLayout } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, type GtkBoxProps } from "@gtkx/jsx/gtk";
import { ConstraintChildButtons } from "./child-buttons.js";

const A = Gtk.ConstraintAttribute;

const TopEdgeConstraint = (): ReactNode => (
    <ConstraintLayout.Constraint target="button1" targetAttribute={A.TOP} sourceAttribute={A.TOP} constant={8} />
);

const BottomEdgeConstraint = (): ReactNode => (
    <ConstraintLayout.Constraint target="button3" targetAttribute={A.BOTTOM} sourceAttribute={A.BOTTOM} constant={-8} />
);

const StartEdgeConstraint = ({ target }: { target: string }): ReactNode => (
    <ConstraintLayout.Constraint target={target} targetAttribute={A.START} sourceAttribute={A.START} constant={8} />
);

const EndEdgeConstraint = ({ target }: { target: string }): ReactNode => (
    <ConstraintLayout.Constraint target={target} targetAttribute={A.END} sourceAttribute={A.END} constant={-8} />
);

const ConstraintContainer = ({
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

export { BottomEdgeConstraint, ConstraintContainer, EndEdgeConstraint, StartEdgeConstraint, TopEdgeConstraint };
