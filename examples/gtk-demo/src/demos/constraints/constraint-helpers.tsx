import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, type GtkBoxProps, GtkConstraint } from "@gtkx/jsx/gtk";
import { type ChildButtonHandlers, ConstraintChildButtons } from "./child-buttons.js";

type ConstraintContainerProps = {
    layoutManager: GtkBoxProps["layoutManager"];
    handlers: ChildButtonHandlers;
    controllers?: GtkBoxProps["controllers"];
};

const A = Gtk.ConstraintAttribute;

const edgeConstraint = (target: Gtk.ConstraintTarget, edge: Gtk.ConstraintAttribute, constant: number): ReactNode => (
    <GtkConstraint target={target} targetAttribute={edge} sourceAttribute={edge} constant={constant} />
);

const topEdgeConstraint = (target: Gtk.ConstraintTarget): ReactNode => edgeConstraint(target, A.TOP, 8);
const bottomEdgeConstraint = (target: Gtk.ConstraintTarget): ReactNode => edgeConstraint(target, A.BOTTOM, -8);
const startEdgeConstraint = (target: Gtk.ConstraintTarget): ReactNode => edgeConstraint(target, A.START, 8);
const endEdgeConstraint = (target: Gtk.ConstraintTarget): ReactNode => edgeConstraint(target, A.END, -8);

const ConstraintContainer = ({ layoutManager, handlers, controllers }: ConstraintContainerProps): ReactNode => (
    <GtkBox name="container" hexpand vexpand layoutManager={layoutManager} controllers={controllers}>
        <ConstraintChildButtons {...handlers} />
    </GtkBox>
);

export { bottomEdgeConstraint, ConstraintContainer, endEdgeConstraint, startEdgeConstraint, topEdgeConstraint };
