import type { VflConstraints } from "@gtkx/react";
import type { ReactElement, ReactNode } from "react";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkConstraint, GtkConstraintGuide, GtkConstraintLayout } from "@gtkx/jsx/gtk";
import {
    createContext,
    useContext,
    useEffectEvent,
    useId,
    useLayoutEffect,
    useMemo,
    useState,
    useSyncExternalStore,
} from "react";
import type { ConstraintGuideProps, ConstraintLayoutProps, ConstraintProps, ConstraintVflProps } from "./types.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";

type Declaration =
    | { kind: "constraint"; props: ConstraintProps } |
    { kind: "guide"; props: ConstraintGuideProps } |
    { kind: "vfl"; props: ConstraintVflProps };

type Entry = { signature: string; declaration: Declaration };
type Declarations = Map<string, Entry>;

type Registry = {
    set: (key: string, entry: Entry) => void;
    remove: (key: string) => void;
};

type Targets = Map<string, Gtk.ConstraintTarget>;
type KindEntry<K extends Declaration["kind"]> = { signature: string; declaration: Extract<Declaration, { kind: K }> };

type TargetsStore = {
    subscribe: (onChange: () => void) => () => void;
    snapshot: () => Targets | null;
    sync: (layout: Gtk.ConstraintLayout | null) => void;
};

type ConstraintLayoutComponent = ((props: ConstraintLayoutProps) => ReactNode) & {
    Constraint: (props: ConstraintProps) => ReactNode;
    Guide: (props: ConstraintGuideProps) => ReactNode;
    Vfl: (props: ConstraintVflProps) => ReactNode;
};

const ConstraintContext = createContext<Registry | null>(null);
const ORPHAN_MESSAGE = "<ConstraintLayout.Constraint> / <Guide> / <Vfl> must be a child of <ConstraintLayout>";

/**
 * Installs a Gtk.ConstraintLayout on a host widget's layoutManager slot, with
 * `ConstraintLayout.Constraint`, `ConstraintLayout.Guide`, and
 * `ConstraintLayout.Vfl` declaring its constraints.
 */
const ConstraintLayout: ConstraintLayoutComponent = Object.assign(ConstraintLayoutRoot, {
    Constraint,
    Guide,
    Vfl,
});

const typeNameOfWidget = (widget: Gtk.Widget): string => GObject.typeName(widget.__type__) ?? "";

const addNamedGuide = (guide: GObject.Object | null, targets: Targets): void => {
    if (!(guide instanceof Gtk.ConstraintGuide)) {
        return;
    }

    const name = guide.getName();

    if (name !== null && name !== "") {
        targets.set(name, guide);
    }
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

        if (name !== "" && name !== typeNameOfWidget(child) && !targets.has(name)) {
            targets.set(name, child);
        }

        child = child.getNextSibling();
    }
};

const readTargets = (layout: Gtk.ConstraintLayout): Targets => {
    const targets: Targets = new Map();
    addNamedGuides(layout, targets);
    addNamedChildren(layout, targets);

    return targets;
};

const hasSameTargets = (previous: Targets, next: Targets): boolean =>
    previous.size === next.size && [...previous].every(([name, target]) => next.get(name) === target);

const resolveTarget = (
    id: string | undefined,
    role: "target" | "source",
    targets: Targets,
): Gtk.ConstraintTarget | null => {
    if (id === undefined || id === "super") {
        return null;
    }

    const target = targets.get(id);

    if (target !== undefined) {
        return target;
    }

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
        key={key}
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

const getElements = <K extends Declaration["kind"]>(
    declarations: Declarations,
    kind: K,
    build: (key: string, entry: KindEntry<K>) => ReactElement,
): ReactElement[] => {
    const elements: ReactElement[] = [];

    for (const [key, entry] of declarations) {
        if (entry.declaration.kind === kind) {
            elements.push(build(key, entry as KindEntry<K>));
        }
    }

    return elements;
};

const vflBlocks = (declarations: Declarations, targets: Targets): VflConstraints[] => {
    const blocks: VflConstraints[] = [];

    for (const { declaration } of declarations.values()) {
        if (declaration.kind !== "vfl") {
            continue;
        }

        const { lines, hspacing, vspacing } = declaration.props;
        blocks.push({ lines, hspacing: hspacing ?? 0, vspacing: vspacing ?? 0, views: targets });
    }

    return blocks;
};

const useDeclaration = (declaration: Declaration): null => {
    const registry = useContext(ConstraintContext);

    if (registry === null) {
        throw new Error(ORPHAN_MESSAGE);
    }

    const key = useId();
    const signature = JSON.stringify(declaration);
    const currentDeclaration = useEffectEvent((): Declaration => declaration);

    useLayoutEffect(() => {
        registry.set(key, { signature, declaration: currentDeclaration() });
    }, [registry, key, signature]);

    useLayoutEffect(() => () => {
        registry.remove(key);
    }, [registry, key]);

    return null;
};

function Constraint(props: ConstraintProps): ReactNode {
    return useDeclaration({ kind: "constraint", props });
}

function Guide(props: ConstraintGuideProps): ReactNode {
    return useDeclaration({ kind: "guide", props });
}

function Vfl(props: ConstraintVflProps): ReactNode {
    return useDeclaration({ kind: "vfl", props });
}

const useRegistry = (setDeclarations: (update: (previous: Declarations) => Declarations) => void): Registry =>
    useMemo<Registry>(
        () => ({
            set: (key, entry) => {
                setDeclarations((previous) => new Map(previous).set(key, entry));
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

const nextTargets = (current: Targets | null, layout: Gtk.ConstraintLayout | null): Targets | null => {
    if (layout === null) {
        return null;
    }

    const next = readTargets(layout);

    if (current !== null && hasSameTargets(current, next)) {
        return null;
    }

    return next;
};

const createTargetsStore = (): TargetsStore => {
    const listeners: Set<() => void> = new Set();
    let current: Targets | null = null;

    return {
        subscribe: (onChange) => {
            listeners.add(onChange);

            return () => {
                listeners.delete(onChange);
            };
        },
        snapshot: () => current,
        sync: (layout) => {
            const next = nextTargets(current, layout);

            if (next === null) {
                return;
            }

            current = next;

            for (const listener of listeners) {
                listener();
            }
        },
    };
};

const useTargets = (layout: Gtk.ConstraintLayout | null): Targets | null => {
    const store = useMemo(() => createTargetsStore(), []);

    useLayoutEffect(() => {
        store.sync(layout);
    });

    return useSyncExternalStore(store.subscribe, store.snapshot);
};

function ConstraintLayoutRoot(props: ConstraintLayoutProps): ReactNode {
    const { children, ref } = props;
    const [layout, refCallback] = useWidgetRef<Gtk.ConstraintLayout>(ref);
    const [declarations, setDeclarations] = useState<Declarations>(() => new Map());
    const registry = useRegistry(setDeclarations);
    const targets = useTargets(layout);

    const guides = useMemo(
        () => getElements(declarations, "guide", (key, entry) => guideElement(key, entry.declaration.props)),
        [declarations],
    );

    const constraints = useMemo(
        () =>
            targets === null
                ? null
                : getElements(declarations, "constraint", (key, entry) =>
                        constraintElement(`${key}:${entry.signature}`, entry.declaration.props, targets),
                    ),
        [declarations, targets],
    );

    const vfl = useMemo(() => (targets === null ? null : vflBlocks(declarations, targets)), [declarations, targets]);

    return (
        <ConstraintContext.Provider value={registry}>
            <GtkConstraintLayout ref={refCallback} guides={guides} constraints={constraints} vfl={vfl} />
            {children}
        </ConstraintContext.Provider>
    );
}

export { ConstraintLayout };
