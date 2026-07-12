import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";

/**
 * Describes one constraint added by {@link ConstraintLayout.Constraint}, relating a
 * target widget attribute to a source attribute of another widget or guide.
 */
export type ConstraintProps = {
    /** Name of the target widget or guide. Use "super" or omit to reference the layout's own widget. */
    target?: string;
    targetAttribute: Gtk.ConstraintAttribute;
    /** Relation between the target and source attributes (defaults to equality). */
    relation?: Gtk.ConstraintRelation;
    /** Name of the source widget or guide. Use "super" or omit for a constant constraint. */
    source?: string;
    sourceAttribute?: Gtk.ConstraintAttribute;
    /** Factor applied to the source attribute (defaults to 1). */
    multiplier?: number;
    /** Constant offset added to the relation (defaults to 0). */
    constant?: number;
    /** Constraint strength, higher values winning conflicts (defaults to required). */
    strength?: number;
};

/**
 * Describes an invisible spacing guide added by {@link ConstraintLayout.Guide},
 * usable as a constraint target under its id.
 */
export type ConstraintGuideProps = {
    /** Identifier used to reference this guide from constraints. */
    id: string;
    minWidth?: number;
    minHeight?: number;
    /** Preferred (natural) width. */
    natWidth?: number;
    /** Preferred (natural) height. */
    natHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    /** Strength of the guide's own size constraints. */
    strength?: Gtk.ConstraintStrength;
};

/**
 * Describes constraints authored with the Visual Format Language (VFL), applied by
 * {@link ConstraintLayout.Vfl}.
 */
export type ConstraintVflProps = {
    /** VFL lines describing the constraints between named widgets and guides. */
    lines: string[];
    /** Default horizontal spacing used by the layout operator (defaults to 0). */
    hspacing?: number;
    /** Default vertical spacing used by the layout operator (defaults to 0). */
    vspacing?: number;
};

const SUPER_ID = "super";

const unknownIdMessage = (role: string, id: string): string =>
    `<ConstraintLayout.Constraint> references unknown id '${id}'. ` +
    `Set name="${id}" on the ${role} widget, or add a <ConstraintLayout.Guide id="${id}">.`;

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

export function applyVfl(layout: Gtk.ConstraintLayout, props: ConstraintVflProps): () => void {
    const views = constraintViews(layout);
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
