import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { ConstraintGuideProps, ConstraintProps, ConstraintVflProps } from "../utils/element-props.js";

const SUPER_ID = "super";

const unknownIdMessage = (role: string, id: string): string =>
    `<GtkConstraintLayout.Constraint> references unknown id '${id}'. ` +
    `Set name="${id}" on the ${role} widget, or add a <GtkConstraintLayout.Guide id="${id}">.`;

const guideRegistry = new WeakMap<Gtk.ConstraintLayout, Map<string, Gtk.ConstraintGuide>>();

const guidesFor = (layout: Gtk.ConstraintLayout): Map<string, Gtk.ConstraintGuide> => {
    let map = guideRegistry.get(layout);
    if (!map) {
        map = new Map<string, Gtk.ConstraintGuide>();
        guideRegistry.set(layout, map);
    }
    return map;
};

const explicitWidgetName = (widget: Gtk.Widget): string | null => {
    const value = new GObject.Value();
    value.init(GObject.TYPE_STRING);
    widget.getProperty("name", value);
    const name = value.getString();
    return name !== null && name.length > 0 ? name : null;
};

function* namedChildren(layout: Gtk.ConstraintLayout): Generator<[string, Gtk.Widget]> {
    const host = layout.getWidget();
    if (!host) return;
    for (let child = host.getFirstChild(); child; child = child.getNextSibling()) {
        const name = explicitWidgetName(child);
        if (name !== null) yield [name, child];
    }
}

const findChildByName = (layout: Gtk.ConstraintLayout, id: string): Gtk.Widget | undefined => {
    for (const [name, child] of namedChildren(layout)) {
        if (name === id) return child;
    }
    return undefined;
};

const resolveConstraintTarget = (
    layout: Gtk.ConstraintLayout,
    id: string | undefined,
): Gtk.ConstraintTarget | null | undefined => {
    if (id === undefined || id === SUPER_ID) return null;
    return findChildByName(layout, id) ?? guidesFor(layout).get(id);
};

const constraintViews = (layout: Gtk.ConstraintLayout): Map<string, Gtk.ConstraintTarget> => {
    const views = new Map<string, Gtk.ConstraintTarget>();
    for (const [name, child] of namedChildren(layout)) views.set(name, child);
    for (const [name, guide] of guidesFor(layout)) {
        if (!views.has(name)) views.set(name, guide);
    }
    return views;
};

const isLayoutLive = (layout: Gtk.ConstraintLayout): boolean => layout.getWidget() !== null;

/**
 * Resolves the `target`/`source` ids of `props` against `layout`, builds the
 * immutable `Gtk.Constraint`, adds it to the layout, and returns a remover.
 *
 * @param layout - The layout the constraint is added to.
 * @param props - The `<Constraint>` props.
 * @returns A cleanup that removes the constraint while the layout is live.
 * @throws When `target` or `source` references an id matching no named child or guide.
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
 * Parses the VFL lines of `props` against the named children and guides of
 * `layout`, adds the resulting constraints, and returns a remover for them.
 *
 * @param layout - The layout the parsed constraints are added to.
 * @param props - The `<Vfl>` props.
 * @returns A cleanup that removes every parsed constraint while the layout is live.
 */
export function applyVfl(layout: Gtk.ConstraintLayout, props: ConstraintVflProps): () => void {
    const views = constraintViews(layout);
    const constraints = layout.addConstraintsFromDescription(props.lines, props.hspacing ?? 0, props.vspacing ?? 0, views);

    return () => {
        if (!isLayoutLive(layout)) return;
        for (const constraint of constraints) layout.removeConstraint(constraint);
    };
}

/**
 * Creates a `Gtk.ConstraintGuide` from `props`, registers it under its id on
 * `layout`, adds it, and returns a cleanup that removes and unregisters it.
 *
 * The guide is held in a per-layout id map so `<Constraint>`/`<Vfl>` markers
 * resolve guide ids without arming `Gtk.ConstraintLayout.observeGuides` bookkeeping.
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
    guidesFor(layout).set(props.id, guide);

    return () => {
        guidesFor(layout).delete(props.id);
        if (isLayoutLive(layout)) layout.removeGuide(guide);
    };
}
