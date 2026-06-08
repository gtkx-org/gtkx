import * as Gtk from "@gtkx/gi/gtk";
import { createContext, type RefObject, useContext, useRef } from "react";
import type { ConstraintGuideProps, ConstraintProps, ConstraintVflProps } from "./jsx.js";
import {
    registerConstraintTarget,
    resolveConstraintTarget,
    snapshotConstraintTargets,
    unregisterConstraintTarget,
} from "./nodes/internal/constraint-target-registry.js";

const ORPHAN_MESSAGE = "<GtkConstraintLayout.Constraint> / <Guide> / <Vfl> must be a child of <GtkConstraintLayout>";

const unknownIdMessage = (role: string, id: string): string =>
    `<GtkConstraintLayout.Constraint> references unknown id '${id}'. ` +
    `Wrap the ${role} widget in <GtkConstraintLayout.Widget id="${id}"> or ` +
    `add a <GtkConstraintLayout.Guide id="${id}">.`;

/**
 * Context carrying a ref to the live `Gtk.ConstraintLayout` from a
 * `<GtkConstraintLayout>` provider down to its `<Constraint>`, `<Vfl>`, and
 * `<Guide>` children. A `null` value means the marker is not enclosed by a
 * provider.
 */
export const ConstraintLayoutContext = createContext<RefObject<Gtk.ConstraintLayout | null> | null>(null);

/**
 * Owns the ref a `<GtkConstraintLayout>` provider binds to its backing
 * `Gtk.ConstraintLayout` element and shares through {@link ConstraintLayoutContext}.
 *
 * @returns The stable ref to bind to the `<GtkConstraintLayout>` element and to
 *   publish to descendant markers.
 */
export function useConstraintLayout(): RefObject<Gtk.ConstraintLayout | null> {
    return useRef<Gtk.ConstraintLayout | null>(null);
}

/**
 * Reads the enclosing {@link ConstraintLayoutContext}, throwing when a marker is
 * used outside a `<GtkConstraintLayout>`.
 *
 * @returns The ref to the enclosing layout.
 */
export function useConstraintLayoutRef(): RefObject<Gtk.ConstraintLayout | null> {
    const ref = useContext(ConstraintLayoutContext);
    if (!ref) throw new Error(ORPHAN_MESSAGE);
    return ref;
}

/**
 * Returns true while `layout` still owns a widget, mirroring the guard a marker
 * applies before removing its contribution: a layout discarded with its host
 * widget rejects further mutation.
 *
 * @param layout - The layout to test.
 * @returns Whether the layout is still attached to a widget.
 */
const isLayoutLive = (layout: Gtk.ConstraintLayout): boolean => layout.getWidget() !== null;

/**
 * Resolves the `target`/`source` ids of `props` against `layout`, builds the
 * immutable `Gtk.Constraint`, adds it to the layout, and returns a remover.
 *
 * @param layout - The layout the constraint is added to.
 * @param props - The `<Constraint>` props.
 * @returns A cleanup that removes the constraint while the layout is live.
 * @throws When `target` or `source` references an id that was never registered.
 */
export function applyConstraint(layout: Gtk.ConstraintLayout, props: ConstraintProps): () => void {
    const target = resolveConstraintTarget(layout, props.target);
    if (target === undefined) throw new Error(unknownIdMessage("target", String(props.target)));
    const source = resolveConstraintTarget(layout, props.source);
    if (source === undefined) throw new Error(unknownIdMessage("source", String(props.source)));

    const constraint = new Gtk.Constraint({
        target,
        targetAttribute: props.targetAttribute,
        relation: props.relation ?? Gtk.ConstraintRelation.EQ,
        source,
        sourceAttribute: props.sourceAttribute ?? Gtk.ConstraintAttribute.NONE,
        multiplier: props.multiplier ?? 1,
        constant: props.constant ?? 0,
        strength: props.strength ?? Gtk.ConstraintStrength.REQUIRED,
    });
    layout.addConstraint(constraint);

    return () => {
        if (isLayoutLive(layout)) layout.removeConstraint(constraint);
    };
}

/**
 * Parses the VFL lines of `props` against the registered views of `layout`,
 * adds the resulting constraints, and returns a remover for them.
 *
 * @param layout - The layout the parsed constraints are added to.
 * @param props - The `<Vfl>` props.
 * @returns A cleanup that removes every parsed constraint while the layout is live.
 */
export function applyVfl(layout: Gtk.ConstraintLayout, props: ConstraintVflProps): () => void {
    const views = snapshotConstraintTargets(layout);
    const constraints = layout.addConstraintsFromDescription(
        props.lines,
        props.hspacing ?? 0,
        props.vspacing ?? 0,
        views,
    );

    return () => {
        if (!isLayoutLive(layout)) return;
        for (const constraint of constraints) layout.removeConstraint(constraint);
    };
}

/**
 * Creates a `Gtk.ConstraintGuide` from `props`, registers it under its id on
 * `layout`, adds it, and returns a cleanup that removes and unregisters it.
 *
 * @param layout - The layout the guide is added to.
 * @param props - The `<Guide>` props.
 * @returns A cleanup that removes the guide and drops its registration.
 */
export function applyGuide(layout: Gtk.ConstraintLayout, props: ConstraintGuideProps): () => void {
    const guide = new Gtk.ConstraintGuide({
        name: props.id,
        minWidth: props.minWidth,
        minHeight: props.minHeight,
        natWidth: props.natWidth,
        natHeight: props.natHeight,
        maxWidth: props.maxWidth,
        maxHeight: props.maxHeight,
        strength: props.strength,
    });
    layout.addGuide(guide);
    registerConstraintTarget(layout, props.id, guide);

    return () => {
        unregisterConstraintTarget(layout, props.id);
        if (isLayoutLive(layout)) layout.removeGuide(guide);
    };
}
