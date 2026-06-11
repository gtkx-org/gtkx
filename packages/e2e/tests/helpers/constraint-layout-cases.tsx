import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { GtkConstraintLayout } from "@gtkx/react";
import type { ReactNode, RefObject } from "react";
import { expect } from "vitest";

/**
 * Reads the {@link Gtk.ConstraintLayout} installed as the layout manager of the
 * box referenced by `boxRef`.
 *
 * @param boxRef - Ref to the host `GtkBox` that owns the constraint layout.
 */
export const layoutFrom = (boxRef: RefObject<Gtk.Box | null>): Gtk.ConstraintLayout =>
    boxRef.current?.getLayoutManager() as Gtk.ConstraintLayout;

/** Collects every {@link Gtk.Constraint} held by a constraint layout. */
export const collectConstraints = (layout: Gtk.ConstraintLayout): Gtk.Constraint[] => {
    const observer = layout.observeConstraints();
    const out: Gtk.Constraint[] = [];
    for (let i = 0; i < observer.getNItems(); i++) {
        const item = observer.getItem(i);
        if (item instanceof Gtk.Constraint) out.push(item);
    }
    return out;
};

/** Collects every {@link Gtk.ConstraintGuide} held by a constraint layout. */
export const collectGuides = (layout: Gtk.ConstraintLayout): Gtk.ConstraintGuide[] => {
    const observer = layout.observeGuides();
    const out: Gtk.ConstraintGuide[] = [];
    for (let i = 0; i < observer.getNItems(); i++) {
        const item = observer.getItem(i);
        if (item instanceof Gtk.ConstraintGuide) out.push(item);
    }
    return out;
};

/** Collects the constraints of the layout owned by the box behind `boxRef`. */
const constraintsOf = (boxRef: RefObject<Gtk.Box | null>): Gtk.Constraint[] => collectConstraints(layoutFrom(boxRef));

/** Reads the first constraint of the layout owned by the box behind `boxRef`. */
export const firstConstraint = (boxRef: RefObject<Gtk.Box | null>): Gtk.Constraint => {
    const [constraint] = constraintsOf(boxRef);
    if (!constraint) throw new Error("expected at least one constraint");
    return constraint;
};

/**
 * Asserts the layout owned by the box behind `boxRef` holds exactly one
 * constraint and returns it.
 *
 * @param boxRef - Ref to the host `GtkBox` that owns the constraint layout.
 */
export const onlyConstraint = (boxRef: RefObject<Gtk.Box | null>): Gtk.Constraint => {
    const constraints = constraintsOf(boxRef);
    expect(constraints).toHaveLength(1);
    const [constraint] = constraints;
    if (!constraint) throw new Error("expected exactly one constraint");
    return constraint;
};

/**
 * A `GtkConstraintLayout.Widget` marker wrapping a `GtkLabel`, used to register
 * a labelled widget that `Constraint` and `Vfl` markers can resolve by id.
 *
 * @param id - Marker id referenced by constraints and VFL lines.
 * @param label - Text rendered by the wrapped `GtkLabel`.
 * @param labelRef - Optional ref to the wrapped `GtkLabel`.
 */
export const LabelMarker = ({
    id,
    label,
    labelRef,
}: {
    id: string;
    label: string;
    labelRef?: RefObject<Gtk.Label | null>;
}): ReactNode => (
    <GtkConstraintLayout.Widget id={id}>
        <GtkLabel ref={labelRef} label={label} />
    </GtkConstraintLayout.Widget>
);

/**
 * A `GtkConstraintLayout.Widget` marker wrapping a `GtkButton`, used to register
 * a button widget that `Constraint` and `Vfl` markers can resolve by id.
 *
 * @param id - Marker id referenced by constraints and VFL lines.
 * @param label - Text rendered by the wrapped `GtkButton`.
 */
export const ButtonMarker = ({ id, label }: { id: string; label: string }): ReactNode => (
    <GtkConstraintLayout.Widget id={id}>
        <GtkButton label={label} />
    </GtkConstraintLayout.Widget>
);
