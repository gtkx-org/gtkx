import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkConstraintLayout } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLatest } from "./internal/use-latest.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";
import type { ConstraintGuideProps, ConstraintLayoutProps, ConstraintProps, ConstraintVflProps } from "./types.js";

type ConstraintDeclaration =
    | { kind: "constraint"; props: ConstraintProps }
    | { kind: "guide"; props: ConstraintGuideProps }
    | { kind: "vfl"; props: ConstraintVflProps };

type ConstraintRegistry = {
    set: (key: number, declaration: ConstraintDeclaration) => void;
    remove: (key: number) => void;
};

type AppliedArtifacts = {
    constraints: Gtk.Constraint[];
    guides: Gtk.ConstraintGuide[];
};

type ResolutionScope = {
    guides: Map<string, Gtk.ConstraintGuide>;
    names: Map<string, Gtk.Widget>;
};

const ConstraintContext = createContext<ConstraintRegistry | null>(null);

const ORPHAN_MESSAGE = "<ConstraintLayout.Constraint> / <Guide> / <Vfl> must be a child of <ConstraintLayout>";

let declarationSerial = 0;

const typeNameOfWidget = (widget: Gtk.Widget): string => GObject.typeName(widget.__type__) ?? "";

const namedChildrenOf = (layout: Gtk.ConstraintLayout): Map<string, Gtk.Widget> => {
    const names = new Map<string, Gtk.Widget>();
    let child = layout.getWidget()?.getFirstChild() ?? null;
    while (child !== null) {
        const name = child.getName();
        if (name !== "" && name !== typeNameOfWidget(child) && !names.has(name)) names.set(name, child);
        child = child.getNextSibling();
    }
    return names;
};

const resolveEndpoint = (
    id: string | undefined,
    role: "target" | "source",
    scope: ResolutionScope,
): Gtk.ConstraintTarget | null => {
    if (id === undefined || id === "super") return null;
    const guide = scope.guides.get(id);
    if (guide !== undefined) return guide;
    const widget = scope.names.get(id);
    if (widget !== undefined) return widget;
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

const buildConstraint = (props: ConstraintProps, scope: ResolutionScope): Gtk.Constraint =>
    Gtk.Constraint.new(
        resolveEndpoint(props.target, "target", scope),
        props.targetAttribute,
        props.relation ?? Gtk.ConstraintRelation.EQ,
        resolveEndpoint(props.source, "source", scope),
        props.sourceAttribute ?? Gtk.ConstraintAttribute.NONE,
        props.multiplier ?? 1,
        props.constant ?? 0,
        props.strength ?? Gtk.ConstraintStrength.REQUIRED,
    );

const clearApplied = (layout: Gtk.ConstraintLayout, applied: AppliedArtifacts): void => {
    for (const constraint of applied.constraints) layout.removeConstraint(constraint);
    for (const guide of applied.guides) layout.removeGuide(guide);
    applied.constraints = [];
    applied.guides = [];
};

const applyGuides = (
    layout: Gtk.ConstraintLayout,
    declarations: Map<number, ConstraintDeclaration>,
    applied: AppliedArtifacts,
): Map<string, Gtk.ConstraintGuide> => {
    const guides = new Map<string, Gtk.ConstraintGuide>();
    for (const declaration of declarations.values()) {
        if (declaration.kind !== "guide") continue;
        const guide = buildGuide(declaration.props);
        layout.addGuide(guide);
        applied.guides.push(guide);
        guides.set(declaration.props.id, guide);
    }
    return guides;
};

const applyVfl = (
    layout: Gtk.ConstraintLayout,
    props: ConstraintVflProps,
    scope: ResolutionScope,
): Gtk.Constraint[] => {
    const views = new Map<string, Gtk.ConstraintTarget>();
    for (const [name, widget] of scope.names) views.set(name, widget);
    for (const [name, guide] of scope.guides) views.set(name, guide);
    return layout.addConstraintsFromDescription(props.lines, props.hspacing ?? 0, props.vspacing ?? 0, views);
};

const applyDeclarations = (
    layout: Gtk.ConstraintLayout,
    declarations: Map<number, ConstraintDeclaration>,
    applied: AppliedArtifacts,
): void => {
    clearApplied(layout, applied);
    const scope: ResolutionScope = {
        guides: applyGuides(layout, declarations, applied),
        names: namedChildrenOf(layout),
    };
    for (const declaration of declarations.values()) {
        if (declaration.kind === "constraint") {
            const constraint = buildConstraint(declaration.props, scope);
            layout.addConstraint(constraint);
            applied.constraints.push(constraint);
        } else if (declaration.kind === "vfl") {
            applied.constraints.push(...applyVfl(layout, declaration.props, scope));
        }
    }
};

const useDeclaration = (declaration: ConstraintDeclaration): null => {
    const registry = useContext(ConstraintContext);
    if (registry === null) throw new Error(ORPHAN_MESSAGE);
    const keyRef = useRef(0);
    if (keyRef.current === 0) {
        declarationSerial += 1;
        keyRef.current = declarationSerial;
    }
    const key = keyRef.current;
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
    const [declarations, setDeclarations] = useState<Map<number, ConstraintDeclaration>>(() => new Map());
    const appliedRef = useRef<AppliedArtifacts>({ constraints: [], guides: [] });
    const registry = useMemo<ConstraintRegistry>(
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
        applyDeclarations(layout, declarations, appliedRef.current);
    }, [layout, declarations]);
    useLayoutEffect(() => {
        if (layout === null) return;
        return () => clearApplied(layout, appliedRef.current);
    }, [layout]);
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
