import { quote, toCamelCase } from "@gtkx/utils";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { allVirtualSubcomponents } from "./compounds-meta.js";
import { ancestorGlibNames, collectReactNodeClasses, type WidgetCandidate } from "./widgets.js";

type CompoundAccumulator = {
    readonly elementNames: Set<string>;
    readonly compoundPropTypes: Set<string>;
    readonly virtualPropTypes: Set<string>;
    readonly hocImports: Set<TopLevelHoc>;
};

/** The single JSX element name every metadata wrapper renders. */
const WRAPPER_NODE_ELEMENT = "__GTKX_WRAPPER_NODE__";

/** A `@gtkx/react` higher-order component that wraps a top-level surface host. */
type TopLevelHoc = "withTopLevel" | "createApplication" | "withApplicationWindow";

/**
 * Records that the {@link WRAPPER_NODE_ELEMENT} sentinel const must be emitted.
 *
 * @param accumulator - The shared compound accumulator.
 */
const useWrapperElement = (accumulator: CompoundAccumulator): void => {
    accumulator.elementNames.add(WRAPPER_NODE_ELEMENT);
};

/** Module-local const name binding the wrapper sentinel element. */
const wrapperElementConst = (name: string): string =>
    name === WRAPPER_NODE_ELEMENT ? "WrapperNodeElement" : `${name}Element`;

/**
 * Generates `compounds.tsx` source: a statically-compiled React component per
 * widget with slot or container-slot props, a top-level surface wrapper per
 * window/dialog/application class (presented on mount, destroyed on unmount),
 * and one flat component per metadata-child kind (`GtkStackPage`, …).
 *
 * Each slot compound destructures its slot and container-slot props, forwards
 * the rest to the host intrinsic, and wraps each non-null slot value in a
 * `<WrapperNodeElement kind="slot">` (setter, target from `propName`) or
 * `<WrapperNodeElement kind="container-slot">` (append, target from `method`)
 * sentinel element. Each flat virtual component renders the same sentinel with
 * its generic kind and forwards its metadata props.
 *
 * A top-level class is wrapped by a `@gtkx/react` HOC (`withTopLevel`,
 * `createApplication`, or `withApplicationWindow`) applied to its host lazily on
 * first render and memoized in a module-local binding. The generated module and
 * `@gtkx/react` form an import cycle, so a HOC binding is only guaranteed
 * resolved once every module has evaluated; reading it at render time rather
 * than at module load keeps the wrapper correct regardless of evaluation order.
 * The host is a non-exported `${Name}Base` slot-compound when the class has
 * slots, or the bare intrinsic element const otherwise. A host intrinsic is
 * referenced through a module-local `${Name}Element = "Name"` const so the JSX
 * tag does not collide with the exported component of the same name; non
 * top-level widgets with no slots remain bare string-constant intrinsics in
 * `jsx.ts`.
 *
 * @param repository - The loaded GIR repository
 * @param widgetSlotMap - Merged widget-slot names keyed by JSX element name
 * @param containerSlotMap - Merged container-slot methods keyed by JSX element name
 */
export const generateCompounds = (
    repository: GirRepository,
    widgetSlotMap: Readonly<Record<string, readonly string[]>>,
    containerSlotMap: Readonly<Record<string, readonly string[]>>,
): { readonly source: string; readonly exportedNames: ReadonlySet<string> } => {
    const exportedNames = new Set<string>();
    const exportLines: string[] = [];
    const accumulator: CompoundAccumulator = {
        elementNames: new Set<string>(),
        compoundPropTypes: new Set<string>(),
        virtualPropTypes: new Set<string>(),
        hocImports: new Set<TopLevelHoc>(),
    };

    for (const candidate of collectReactNodeClasses(repository)) {
        const { glibName, klass, namespace } = candidate;
        const slots = resolveInheritedSlots(widgetSlotMap, klass, namespace, repository);
        const containers = containerSlotMap[glibName] ?? [];
        const hoc = topLevelHoc(klass, namespace, repository);
        if (hoc === undefined && slots.length === 0 && containers.length === 0) continue;

        exportLines.push(renderCompound({ glibName, slots, containers, hoc }, accumulator));
        exportedNames.add(glibName);
    }

    for (const virtual of allVirtualSubcomponents()) {
        useWrapperElement(accumulator);
        accumulator.virtualPropTypes.add(virtual.propsType);
        exportLines.push(
            `export const ${virtual.flatName} = (props: ${virtual.propsType}): ReactNode => (\n    <WrapperNodeElement kind=${quote(virtual.kind)} {...props} />\n);`,
        );
        exportedNames.add(virtual.flatName);
    }

    const sections = [
        renderImportLines(accumulator).join("\n"),
        renderElementConsts(accumulator),
        exportLines.join("\n\n"),
    ];
    const source = `${sections.filter((section) => section.length > 0).join("\n\n")}\n`;
    return { source, exportedNames };
};

/** The HOC precedence list, applied in order against a class's ancestry. */
const TOP_LEVEL_RULES: readonly { readonly ancestors: readonly string[]; readonly hoc: TopLevelHoc }[] = [
    { ancestors: ["GtkApplication"], hoc: "createApplication" },
    { ancestors: ["GtkApplicationWindow"], hoc: "withApplicationWindow" },
    { ancestors: ["GtkWindow", "AdwDialog"], hoc: "withTopLevel" },
];

/**
 * Classifies a class as a top-level surface by its GLib-type ancestry, returning
 * the `@gtkx/react` HOC that wraps it, or `undefined` when it is not a top-level
 * surface. An application takes precedence over an application window, which
 * takes precedence over a plain window or Adwaita dialog.
 *
 * @param klass - The class to classify
 * @param namespace - The namespace the class lives in
 * @param repository - The repository for cross-namespace parent lookups
 */
const topLevelHoc = (
    klass: WidgetCandidate["klass"],
    namespace: GirNamespace,
    repository: GirRepository,
): TopLevelHoc | undefined => {
    const ancestry = new Set(ancestorGlibNames(klass, namespace, repository));
    for (const rule of TOP_LEVEL_RULES) {
        if (rule.ancestors.some((ancestor) => ancestry.has(ancestor))) return rule.hoc;
    }
    return undefined;
};

type CompoundShape = {
    readonly glibName: string;
    readonly slots: readonly string[];
    readonly containers: readonly string[];
    readonly hoc: TopLevelHoc | undefined;
};

const renderCompound = (shape: CompoundShape, accumulator: CompoundAccumulator): string => {
    const { glibName, slots, containers, hoc } = shape;
    const propsType = `${glibName}Props`;
    accumulator.compoundPropTypes.add(propsType);
    accumulator.elementNames.add(glibName);
    const hasSlots = slots.length > 0 || containers.length > 0;
    if (hasSlots) useWrapperElement(accumulator);
    if (hoc === undefined) {
        return `export const ${glibName} = ${renderComponentFunction(glibName, propsType, slots, containers)};`;
    }
    accumulator.hocImports.add(hoc);
    return renderTopLevelCompound({ glibName, propsType, slots, containers, hoc });
};

type TopLevelCompoundShape = {
    readonly glibName: string;
    readonly propsType: string;
    readonly slots: readonly string[];
    readonly containers: readonly string[];
    readonly hoc: TopLevelHoc;
};

const renderTopLevelCompound = (shape: TopLevelCompoundShape): string => {
    const { glibName, propsType, slots, containers, hoc } = shape;
    const componentPropsType =
        hoc === "createApplication" ? `Omit<${propsType}, "menubar"> & { menubar?: ReactNode }` : propsType;
    const annotation = `(props: ${componentPropsType}) => ReactNode`;
    const hasSlots = slots.length > 0 || containers.length > 0;
    const host = hasSlots ? `${glibName}Base` : `${glibName}Element`;
    const memo = `${toCamelCase(glibName)}Instance`;
    const lines: string[] = [];
    if (hasSlots) {
        lines.push(`const ${host} = ${renderComponentFunction(glibName, propsType, slots, containers)};`, "");
    }
    lines.push(
        `let ${memo}: (${annotation}) | undefined;`,
        `export const ${glibName}: ${annotation} = (props) => (${memo} ??= ${hoc}<${componentPropsType}>(${host}))(props);`,
    );
    return lines.join("\n");
};

const renderComponentFunction = (
    glibName: string,
    propsType: string,
    slots: readonly string[],
    containers: readonly string[],
): string => {
    const host = `${glibName}Element`;
    const destructured = [...slots, ...containers, "children"].join(", ");
    const slotChildren = [
        ...slots.map((slot) => renderSlotChild("slot", "propName", slot)),
        ...containers.map((container) => renderSlotChild("container-slot", "method", container)),
    ];
    return [
        `(props: ${propsType}): ReactNode => {`,
        `    const { ${destructured}, ...rest } = props;`,
        "    return (",
        `        <${host} {...rest}>`,
        "            {children}",
        ...slotChildren.map((child) => `            ${child}`),
        `        </${host}>`,
        "    );",
        "}",
    ].join("\n");
};

const renderSlotChild = (kind: string, targetProp: string, slot: string): string =>
    `{${slot} != null && <WrapperNodeElement kind=${quote(kind)} ${targetProp}=${quote(slot)}>{${slot}}</WrapperNodeElement>}`;

const renderElementConsts = (accumulator: CompoundAccumulator): string =>
    [...accumulator.elementNames]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => `const ${wrapperElementConst(name)} = ${quote(name)} as const;`)
        .join("\n");

const renderImportLines = (accumulator: CompoundAccumulator): readonly string[] => {
    const lines = ['import type { ReactNode } from "react";'];
    const hocImports = [...accumulator.hocImports].sort((a, b) => a.localeCompare(b));
    if (hocImports.length > 0) {
        lines.push(`import { ${hocImports.join(", ")} } from "@gtkx/react";`);
    }
    const compoundPropTypes = [...accumulator.compoundPropTypes].sort((a, b) => a.localeCompare(b));
    if (compoundPropTypes.length > 0) {
        lines.push(`import type { ${compoundPropTypes.join(", ")} } from "./jsx.js";`);
    }
    const virtualPropTypes = [...accumulator.virtualPropTypes].sort((a, b) => a.localeCompare(b));
    if (virtualPropTypes.length > 0) {
        lines.push(`import type { ${virtualPropTypes.join(", ")} } from "@gtkx/react";`);
    }
    return lines;
};

const resolveInheritedSlots = (
    widgetSlotMap: Readonly<Record<string, readonly string[]>>,
    klass: WidgetCandidate["klass"],
    namespace: WidgetCandidate["namespace"],
    repository: GirRepository,
): readonly string[] => {
    const seen = new Set<string>();
    const slots: string[] = [];
    for (const glibName of ancestorGlibNames(klass, namespace, repository)) {
        for (const slot of widgetSlotMap[glibName] ?? []) {
            if (seen.has(slot)) continue;
            seen.add(slot);
            slots.push(slot);
        }
    }
    return slots;
};
