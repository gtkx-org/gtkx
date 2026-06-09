import { quote, toCamelCase } from "@gtkx/utils";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { type VirtualSubcomponent, virtualSubcomponentEntries } from "./compounds-meta.js";
import type { JsxImports } from "./imports.js";
import { ancestorGlibNames, collectReactNodeClasses, type WidgetCandidate } from "./widgets.js";

type CompoundAccumulator = {
    readonly elementNames: Set<string>;
    readonly imports: JsxImports;
};

/** The single JSX element name every metadata wrapper renders. */
const WRAPPER_NODE_ELEMENT = "__GTKX_WRAPPER_NODE__";

/** A `@gtkx/react` higher-order component that wraps a compound's host element. */
type CompoundHoc =
    | "withTopLevel"
    | "withApplication"
    | "withApplicationWindow"
    | "withColorDialog"
    | "withFontDialog"
    | "withActionAccels"
    | "withActionScope";

/**
 * Records that the {@link WRAPPER_NODE_ELEMENT} sentinel const must be emitted.
 *
 * @param accumulator - The shared compound accumulator.
 */
const recordWrapperElement = (accumulator: CompoundAccumulator): void => {
    accumulator.elementNames.add(WRAPPER_NODE_ELEMENT);
};

/** Module-local const name binding the wrapper sentinel element. */
const wrapperElementConst = (name: string): string =>
    name === WRAPPER_NODE_ELEMENT ? "WrapperNodeElement" : `${name}Element`;

/**
 * Generates the compounds section of one namespace's `@gtkx/jsx` module: a
 * statically-compiled React component per widget with slot or container-slot
 * props, a top-level surface wrapper per window/dialog/application class, and one
 * flat component per metadata-child kind whose parent lives in this namespace
 * (`GtkStackPage`, …).
 *
 * Element-name consts the components render are emitted as module-local
 * `${Name}Element = "Name"` bindings. HOC value imports, `react` builtins, and
 * shared virtual prop types accumulate into `imports`; compound prop types resolve
 * locally because the intrinsic section of the same module declares them.
 *
 * @param targetNamespace - The namespace this module is generated for
 * @param repository - The loaded GIR repository
 * @param options - The merged widget-slot and container-slot maps, the shared
 *   import accumulator, and the widget names a hand-written `@gtkx/react`
 *   component owns (skipped here)
 */
export const generateCompoundsSection = (
    targetNamespace: GirNamespace,
    repository: GirRepository,
    options: {
        readonly widgetSlotMap: Readonly<Record<string, readonly string[]>>;
        readonly containerSlotMap: Readonly<Record<string, readonly string[]>>;
        readonly imports: JsxImports;
        readonly excludeNames: ReadonlySet<string>;
    },
): { readonly source: string; readonly exportedNames: ReadonlySet<string> } => {
    const { widgetSlotMap, containerSlotMap, imports, excludeNames } = options;
    const exportedNames = new Set<string>();
    const exportLines: string[] = [];
    const accumulator: CompoundAccumulator = { elementNames: new Set<string>(), imports };

    for (const candidate of collectReactNodeClasses(repository)) {
        if (candidate.namespace.name !== targetNamespace.name) continue;
        if (excludeNames.has(candidate.glibName)) continue;
        const { glibName, klass, namespace } = candidate;
        const slots = resolveInheritedSlots(widgetSlotMap, klass, namespace, repository);
        const containers = containerSlotMap[glibName] ?? [];
        const hoc = compoundHoc(klass, namespace, repository);
        if (hoc === undefined && slots.length === 0 && containers.length === 0) continue;

        exportLines.push(renderCompound({ glibName, slots, containers, hoc }, accumulator));
        exportedNames.add(glibName);
    }

    for (const virtual of virtualSubcomponentsForNamespace(targetNamespace, repository)) {
        recordWrapperElement(accumulator);
        accumulator.imports.sharedTypes.add(virtual.propsType);
        accumulator.imports.reactBuiltins.add("ReactNode");
        exportLines.push(renderVirtualSubcomponent(virtual));
        exportedNames.add(virtual.flatName);
    }

    const sections = [renderElementConsts(accumulator), exportLines.join("\n\n")];
    const source = sections.filter((section) => section.length > 0).join("\n\n");
    return { source, exportedNames };
};

/**
 * Returns the virtual subcomponents whose standing-in parent widget belongs to
 * the target namespace. Each distinct virtual is assigned to the first parent
 * that contributes it (so a virtual shared by `GtkTextView` and `GtkSourceView`
 * lands in `gtk`, the first parent), keeping it declared in exactly one module.
 *
 * @param targetNamespace - The namespace this module is generated for
 * @param repository - The loaded GIR repository
 */
const virtualSubcomponentsForNamespace = (
    targetNamespace: GirNamespace,
    repository: GirRepository,
): readonly VirtualSubcomponent[] => {
    const namespaceByGlib = new Map(
        collectReactNodeClasses(repository).map((entry) => [entry.glibName, entry.namespace.name]),
    );
    const seen = new Set<string>();
    const result: VirtualSubcomponent[] = [];
    for (const { parentGlibName, virtual } of virtualSubcomponentEntries()) {
        if (seen.has(virtual.flatName)) continue;
        seen.add(virtual.flatName);
        if (namespaceByGlib.get(parentGlibName) === targetNamespace.name) result.push(virtual);
    }
    return result.sort((a, b) => a.flatName.localeCompare(b.flatName));
};

/** The HOC precedence list, applied in order against a class's ancestry. */
const COMPOUND_HOC_RULES: readonly { readonly ancestors: readonly string[]; readonly hoc: CompoundHoc }[] = [
    { ancestors: ["GtkApplication"], hoc: "withApplication" },
    { ancestors: ["GtkApplicationWindow"], hoc: "withApplicationWindow" },
    { ancestors: ["GtkWindow", "AdwDialog"], hoc: "withTopLevel" },
    { ancestors: ["GtkColorDialogButton"], hoc: "withColorDialog" },
    { ancestors: ["GtkFontDialogButton"], hoc: "withFontDialog" },
    { ancestors: ["GSimpleAction"], hoc: "withActionAccels" },
    { ancestors: ["GSimpleActionGroup"], hoc: "withActionScope" },
];

/**
 * Classifies a class by its GLib-type ancestry, returning the `@gtkx/react`
 * HOC that wraps its compound, or `undefined` when the class needs none. An
 * application takes precedence over an application window, which takes
 * precedence over a plain window or Adwaita dialog; the remaining rules wrap
 * behavior-carrying hosts (dialog buttons, actions, action groups).
 *
 * @param klass - The class to classify
 * @param namespace - The namespace the class lives in
 * @param repository - The repository for cross-namespace parent lookups
 */
const compoundHoc = (
    klass: WidgetCandidate["klass"],
    namespace: GirNamespace,
    repository: GirRepository,
): CompoundHoc | undefined => {
    const ancestry = new Set(ancestorGlibNames(klass, namespace, repository));
    for (const rule of COMPOUND_HOC_RULES) {
        if (rule.ancestors.some((ancestor) => ancestry.has(ancestor))) return rule.hoc;
    }
    return undefined;
};

type CompoundShape = {
    readonly glibName: string;
    readonly slots: readonly string[];
    readonly containers: readonly string[];
    readonly hoc: CompoundHoc | undefined;
};

const renderCompound = (shape: CompoundShape, accumulator: CompoundAccumulator): string => {
    const { glibName, slots, containers, hoc } = shape;
    const propsType = `${glibName}Props`;
    accumulator.elementNames.add(glibName);
    accumulator.imports.reactBuiltins.add("ReactNode");
    const hasSlots = slots.length > 0 || containers.length > 0;
    if (hasSlots) recordWrapperElement(accumulator);
    if (hoc === undefined) {
        return `export const ${glibName} = ${renderComponentFunction(glibName, propsType, slots, containers)};`;
    }
    accumulator.imports.hocs.add(hoc);
    return renderHocCompound({ glibName, propsType, slots, containers, hoc });
};

type HocCompoundShape = {
    readonly glibName: string;
    readonly propsType: string;
    readonly slots: readonly string[];
    readonly containers: readonly string[];
    readonly hoc: CompoundHoc;
};

const renderHocCompound = (shape: HocCompoundShape): string => {
    const { glibName, propsType, slots, containers, hoc } = shape;
    const componentPropsType =
        hoc === "withApplication" ? `Omit<${propsType}, "menubar"> & { menubar?: ReactNode }` : propsType;
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

/**
 * Emits the conditional inert wrapper child for a positionally-consumed slot:
 * `{prop != null && <WrapperNodeElement kind="...">{prop}</WrapperNodeElement>}`.
 * Unlike {@link renderSlotChild} it carries no target attribute, because the
 * enclosing meta-object reads this wrapper's child by position rather than
 * setting a property from it.
 *
 * @param kind - The wrapper kind the child is emitted with.
 * @param prop - The prop name carrying the `ReactNode`.
 */
const renderPositionalSlotChild = (kind: string, prop: string): string =>
    `{${prop} != null && <WrapperNodeElement kind=${quote(kind)}>{${prop}}</WrapperNodeElement>}`;

/**
 * Emits one flat virtual-child subcomponent. A virtual without a slot spreads
 * all its props onto the wrapper sentinel; a virtual with a
 * {@link VirtualSubcomponent.slot} destructures that slot prop and `children`
 * out of the rest, spreads the rest onto the sentinel, and renders `children`
 * followed by the conditional positional slot child.
 *
 * @param virtual - The virtual subcomponent to emit.
 */
const renderVirtualSubcomponent = (virtual: VirtualSubcomponent): string => {
    const { flatName, kind, propsType, slot } = virtual;
    if (slot === undefined) {
        return `export const ${flatName} = (props: ${propsType}): ReactNode => (\n    <WrapperNodeElement kind=${quote(kind)} {...props} />\n);`;
    }
    return [
        `export const ${flatName} = (props: ${propsType}): ReactNode => {`,
        `    const { ${slot.prop}, children, ...rest } = props;`,
        "    return (",
        `        <WrapperNodeElement kind=${quote(kind)} {...rest}>`,
        "            {children}",
        `            ${renderPositionalSlotChild(slot.kind, slot.prop)}`,
        "        </WrapperNodeElement>",
        "    );",
        "};",
    ].join("\n");
};

const renderElementConsts = (accumulator: CompoundAccumulator): string =>
    [...accumulator.elementNames]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => `const ${wrapperElementConst(name)} = ${quote(name)} as const;`)
        .join("\n");

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
