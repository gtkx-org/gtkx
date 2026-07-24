import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkConstraintLayout } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { createContext, useContext, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLatest } from "./internal/use-latest.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";
import type { ConstraintGuideProps, ConstraintLayoutProps, ConstraintProps, ConstraintVflProps } from "./types.js";

type Declaration =
    | { kind: "constraint"; props: ConstraintProps }
    | { kind: "guide"; props: ConstraintGuideProps }
    | { kind: "vfl"; props: ConstraintVflProps };

type Registry = {
    set: (key: string, declaration: Declaration) => void;
    remove: (key: string) => void;
};

type Targets = Map<string, Gtk.ConstraintTarget>;

const ConstraintContext = createContext<Registry | null>(null);

const ORPHAN_MESSAGE = "<ConstraintLayout.Constraint> / <Guide> / <Vfl> must be a child of <ConstraintLayout>";

const typeNameOfWidget = (widget: Gtk.Widget): string => GObject.typeName(widget.__type__) ?? "";

const namedChildren = (layout: Gtk.ConstraintLayout, targets: Targets): void => {
    let child = layout.getWidget()?.getFirstChild() ?? null;
    while (child !== null) {
        const name = child.getName();
        if (name !== "" && name !== typeNameOfWidget(child) && !targets.has(name)) targets.set(name, child);
        child = child.getNextSibling();
    }
};

const resolveTarget = (
    id: string | undefined,
    role: "target" | "source",
    targets: Targets,
): Gtk.ConstraintTarget | null => {
    if (id === undefined || id === "super") return null;
    const target = targets.get(id);
    if (target !== undefined) return target;
    throw new Error(
        `<ConstraintLayout.Constraint> references unknown id '${id}'. ` +
            `Set name="${id}" on the ${role} widget, or add a <ConstraintLayout.Guide id="${id}">.`,
    );
};

const buildGuide = (props: ConstraintGuideProps): Gtk.ConstraintGuide => {
    const guide = new Gtk.ConstraintGuide({ name: props.id });
    const [minWidth, minHeight] = guide.getMinSize();
    const [natWidth, natHeight] = guide.getNatSize();
    const [maxWidth, maxHeight] = guide.getMaxSize();
    guide.setMinSize(props.minWidth ?? minWidth, props.minHeight ?? minHeight);
    guide.setNatSize(props.natWidth ?? natWidth, props.natHeight ?? natHeight);
    guide.setMaxSize(props.maxWidth ?? maxWidth, props.maxHeight ?? maxHeight);
    if (props.strength !== undefined) guide.setStrength(props.strength);
    return guide;
};

const buildConstraint = (props: ConstraintProps, targets: Targets): Gtk.Constraint =>
    Gtk.Constraint.new(
        resolveTarget(props.target, "target", targets),
        props.targetAttribute,
        props.relation ?? Gtk.ConstraintRelation.EQ,
        resolveTarget(props.source, "source", targets),
        props.sourceAttribute ?? Gtk.ConstraintAttribute.NONE,
        props.multiplier ?? 1,
        props.constant ?? 0,
        props.strength ?? Gtk.ConstraintStrength.REQUIRED,
    );

const apply = (layout: Gtk.ConstraintLayout, declarations: Map<string, Declaration>): (() => void)[] => {
    const undo: (() => void)[] = [];
    const targets: Targets = new Map();
    for (const declaration of declarations.values()) {
        if (declaration.kind !== "guide") continue;
        const guide = buildGuide(declaration.props);
        layout.addGuide(guide);
        targets.set(declaration.props.id, guide);
        undo.push(() => layout.removeGuide(guide));
    }
    namedChildren(layout, targets);
    const addConstraint = (constraint: Gtk.Constraint): void => {
        undo.push(() => layout.removeConstraint(constraint));
    };
    for (const declaration of declarations.values()) {
        if (declaration.kind === "constraint") {
            const constraint = buildConstraint(declaration.props, targets);
            layout.addConstraint(constraint);
            addConstraint(constraint);
        } else if (declaration.kind === "vfl") {
            const { lines, hspacing, vspacing } = declaration.props;
            for (const constraint of layout.addConstraintsFromDescription(
                lines,
                hspacing ?? 0,
                vspacing ?? 0,
                targets,
            )) {
                addConstraint(constraint);
            }
        }
    }
    return undo;
};

const useDeclaration = (declaration: Declaration): null => {
    const registry = useContext(ConstraintContext);
    if (registry === null) throw new Error(ORPHAN_MESSAGE);
    const key = useId();
    const latest = useLatest(declaration);
    const signature = JSON.stringify(declaration);
    useLayoutEffect(() => {
        registry.set(key, latest.current);
    }, [registry, key, latest, signature]);
    useLayoutEffect(() => () => registry.remove(key), [registry, key]);
    return null;
};

const Constraint = (props: ConstraintProps): ReactNode => useDeclaration({ kind: "constraint", props });

const Guide = (props: ConstraintGuideProps): ReactNode => useDeclaration({ kind: "guide", props });

const Vfl = (props: ConstraintVflProps): ReactNode => useDeclaration({ kind: "vfl", props });

const ConstraintLayoutRoot = (props: ConstraintLayoutProps): ReactNode => {
    const { children, ref } = props;
    const [layout, refCallback] = useWidgetRef<Gtk.ConstraintLayout>(ref);
    const [declarations, setDeclarations] = useState<Map<string, Declaration>>(() => new Map());
    const undo = useRef<(() => void)[]>([]);
    const registry = useMemo<Registry>(
        () => ({
            set: (key, declaration) => {
                setDeclarations((previous) => new Map(previous).set(key, declaration));
            },
            remove: (key) => {
                setDeclarations((previous) => {
                    const next = new Map(previous);
                    next.delete(key);
                    return next;
                });
            },
        }),
        [],
    );
    useLayoutEffect(() => {
        if (layout === null) return;
        for (const remove of undo.current) remove();
        undo.current = apply(layout, declarations);
    }, [layout, declarations]);
    useLayoutEffect(
        () => () => {
            for (const remove of undo.current) remove();
            undo.current = [];
        },
        [layout],
    );
    return (
        <ConstraintContext.Provider value={registry}>
            <GtkConstraintLayout ref={refCallback} />
            {children}
        </ConstraintContext.Provider>
    );
};

type ConstraintLayoutComponent = ((props: ConstraintLayoutProps) => ReactNode) & {
    Constraint: (props: ConstraintProps) => ReactNode;
    Guide: (props: ConstraintGuideProps) => ReactNode;
    Vfl: (props: ConstraintVflProps) => ReactNode;
};

/**
 * Installs a Gtk.ConstraintLayout on a host widget's layoutManager slot, with
 * {@link ConstraintLayout.Constraint}, {@link ConstraintLayout.Guide}, and
 * {@link ConstraintLayout.Vfl} declaring its constraints.
 */
export const ConstraintLayout: ConstraintLayoutComponent = Object.assign(ConstraintLayoutRoot, {
    Constraint,
    Guide,
    Vfl,
});
