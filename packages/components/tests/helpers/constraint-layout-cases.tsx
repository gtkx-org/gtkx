import type { ReactNode, RefObject } from "react";
import { ConstraintLayout } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { expect } from "vitest";

const renderConstraintBox = async (
    boxRef: RefObject<Gtk.Box | null>,
    constraintChildren: ReactNode,
    children?: ReactNode,
): Promise<void> => {
    await render(
        <GtkBox ref={boxRef} layoutManager={<ConstraintLayout>{constraintChildren}</ConstraintLayout>}>
            {children}
        </GtkBox>,
    );
};

const layoutFrom = (boxRef: RefObject<Gtk.Box | null>): Gtk.ConstraintLayout =>
    boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;

const collectConstraints = (layout: Gtk.ConstraintLayout): Gtk.Constraint[] => {
    const observer = layout.observeConstraints();
    const out: Gtk.Constraint[] = [];

    for (let i = 0; i < observer.getNItems(); i++) {
        const item = observer.getItem(i);

        if (item instanceof Gtk.Constraint) {
            out.push(item);
        }
    }

    return out;
};

const collectGuides = (layout: Gtk.ConstraintLayout): Gtk.ConstraintGuide[] => {
    const observer = layout.observeGuides();
    const out: Gtk.ConstraintGuide[] = [];

    for (let i = 0; i < observer.getNItems(); i++) {
        const item = observer.getItem(i);

        if (item instanceof Gtk.ConstraintGuide) {
            out.push(item);
        }
    }

    return out;
};

const getConstraints = (boxRef: RefObject<Gtk.Box | null>): Gtk.Constraint[] => collectConstraints(layoutFrom(boxRef));

const firstConstraint = (boxRef: RefObject<Gtk.Box | null>): Gtk.Constraint => {
    const [constraint] = getConstraints(boxRef);

    if (!constraint) {
        throw new Error("expected at least one constraint");
    }

    return constraint;
};

const onlyConstraint = (boxRef: RefObject<Gtk.Box | null>): Gtk.Constraint => {
    const constraints = getConstraints(boxRef);
    expect(constraints).toHaveLength(1);
    const [constraint] = constraints;

    if (!constraint) {
        throw new Error("expected exactly one constraint");
    }

    return constraint;
};

const NamedLabel = ({
    id,
    label,
    labelRef,
}: {
    id: string;
    label: string;
    labelRef?: RefObject<Gtk.Label | null>;
}): ReactNode => (
    <GtkLabel ref={labelRef} name={id}>
        {label}
    </GtkLabel>
);

const NamedButton = ({ id, label }: { id: string; label: string }): ReactNode => (
    <GtkButton name={id} label={label} />
);

export {
    renderConstraintBox,
    layoutFrom,
    collectConstraints,
    collectGuides,
    firstConstraint,
    onlyConstraint,
    NamedLabel,
    NamedButton,
};
