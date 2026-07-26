import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkConstraint, GtkConstraintGuide, GtkConstraintLayout } from "@gtkx/jsx/gtk";
import type { VflConstraints } from "@gtkx/react";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext, useId, useLayoutEffect, useMemo, useState } from "react";
import { useLatest } from "./internal/use-latest.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";
import type { ConstraintGuideProps, ConstraintLayoutProps, ConstraintProps, ConstraintVflProps } from "./types.js";

type Declaration =
    | { kind: "constraint"; props: ConstraintProps }
    | { kind: "guide"; props: ConstraintGuideProps }
    | { kind: "vfl"; props: ConstraintVflProps };

type Declarations = Map<string, Declaration>;

type Registry = {
    set: (key: string, declaration: Declaration) => void;
    remove: (key: string) => void;
};

type Targets = Map<string, Gtk.ConstraintTarget>;

const ConstraintContext = createContext<Registry | null>(null);

const ORPHAN_MESSAGE = "<ConstraintLayout.Constraint> / <Guide> / <Vfl> must be a child of <ConstraintLayout>";

const typeNameOfWidget = (widget: Gtk.Widget): string => GObject.typeName(widget.__type__) ?? "";

const addNamedGuide = (guide: GObject.Object | null, targets: Targets): void => {
    if (!(guide instanceof Gtk.ConstraintGuide)) return;
    const name = guide.getName();
    if (name !== null && name !== "") targets.set(name, guide);
};

const addNamedGuides = (layout: Gtk.ConstraintLayout, targets: Targets): void => {
    const guides = layout.observeGuides();
    for (let index = 0; index < guides.getNItems(); index++) {
        addNamedGuide(guides.getItem(index), targets);
    }
};

const addNamedChildren = (layout: Gtk.ConstraintLayout, targets: Targets): void => {
    let child = layout.getWidget()?.getFirstChild() ?? null;
    while (child !== null) {
        const name = child.getName();
        if (name !== "" && name !== typeNameOfWidget(child) && !targets.has(name)) targets.set(name, child);
        child = child.getNextSibling();
    }
};

const readTargets = (layout: Gtk.ConstraintLayout): Targets => {
    const targets: Targets = new Map();
    addNamedGuides(layout, targets);
    addNamedChildren(layout, targets);
    return targets;
};

const sameTargets = (previous: Targets, next: Targets): boolean =>
    previous.size === next.size && [...previous].every(([name, target]) => next.get(name) === target);

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

const guideElement = (key: string, props: ConstraintGuideProps): ReactElement => (
    <GtkConstraintGuide
        key={key}
        name={props.id}
        minWidth={props.minWidth}
        minHeight={props.minHeight}
        natWidth={props.natWidth}
        natHeight={props.natHeight}
        maxWidth={props.maxWidth}
        maxHeight={props.maxHeight}
        strength={props.strength}
    />
);

const constraintElement = (key: string, props: ConstraintProps, targets: Targets): ReactElement => (
    <GtkConstraint
        key={`${key}:${JSON.stringify(props)}`}
        target={resolveTarget(props.target, "target", targets)}
        targetAttribute={props.targetAttribute}
        relation={props.relation ?? Gtk.ConstraintRelation.EQ}
        source={resolveTarget(props.source, "source", targets)}
        sourceAttribute={props.sourceAttribute ?? Gtk.ConstraintAttribute.NONE}
        multiplier={props.multiplier ?? 1}
        constant={props.constant ?? 0}
        strength={props.strength ?? Gtk.ConstraintStrength.REQUIRED}
    />
);

const elementsOf = <K extends Declaration["kind"]>(
    declarations: Declarations,
    kind: K,
    build: (key: string, declaration: Extract<Declaration, { kind: K }>) => ReactElement,
): ReactElement[] => {
    const elements: ReactElement[] = [];
    for (const [key, declaration] of declarations) {
        if (declaration.kind === kind) elements.push(build(key, declaration as Extract<Declaration, { kind: K }>));
    }
    return elements;
};

const vflBlocks = (declarations: Declarations, targets: Targets): VflConstraints[] => {
    const blocks: VflConstraints[] = [];
    for (const declaration of declarations.values()) {
        if (declaration.kind !== "vfl") continue;
        const { lines, hspacing, vspacing } = declaration.props;
        blocks.push({ lines, hspacing: hspacing ?? 0, vspacing: vspacing ?? 0, views: targets });
    }
    return blocks;
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

const useRegistry = (setDeclarations: (update: (previous: Declarations) => Declarations) => void): Registry =>
    useMemo<Registry>(
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
        [setDeclarations],
    );

const useTargets = (layout: Gtk.ConstraintLayout | null): Targets | null => {
    const [targets, setTargets] = useState<Targets | null>(null);
    useLayoutEffect(() => {
        if (layout === null) return;
        const next = readTargets(layout);
        setTargets((previous) => (previous !== null && sameTargets(previous, next) ? previous : next));
    });
    return targets;
};

const ConstraintLayoutRoot = (props: ConstraintLayoutProps): ReactNode => {
    const { children, ref } = props;
    const [layout, refCallback] = useWidgetRef<Gtk.ConstraintLayout>(ref);
    const [declarations, setDeclarations] = useState<Declarations>(() => new Map());
    const registry = useRegistry(setDeclarations);
    const targets = useTargets(layout);
    const guides = useMemo(
        () => elementsOf(declarations, "guide", (key, it) => guideElement(key, it.props)),
        [declarations],
    );
    const constraints = useMemo(
        () =>
            targets === null
                ? null
                : elementsOf(declarations, "constraint", (key, it) => constraintElement(key, it.props, targets)),
        [declarations, targets],
    );
    const vfl = useMemo(() => (targets === null ? null : vflBlocks(declarations, targets)), [declarations, targets]);
    return (
        <ConstraintContext.Provider value={registry}>
            <GtkConstraintLayout ref={refCallback} guides={guides} constraints={constraints} vfl={vfl} />
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
