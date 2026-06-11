import { quote, toCamelCase } from "@gtkx/utils";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { type VirtualSubcomponent, virtualSubcomponentEntries } from "./compounds-meta.js";
import type { JsxImports } from "./imports.js";
import { ancestorGlibNames, collectReactNodeClasses, type WidgetCandidate } from "./widgets.js";

/** The single JSX element name every metadata wrapper renders. */
const WRAPPER_NODE_ELEMENT = "__GTKX_WRAPPER_NODE__";

/** Module-local const name binding the wrapper sentinel element. */
const WRAPPER_ELEMENT_CONST = "WrapperNodeElement";

/** A `@gtkx/react` higher-order component that wraps a compound's host component. */
type CompoundHoc =
    | "withTopLevel"
    | "withApplication"
    | "withApplicationWindow"
    | "withColorDialog"
    | "withFontDialog"
    | "withActionAccels"
    | "withActionScope";

/**
 * Generates the compounds section of one namespace's `@gtkx/jsx` module: one
 * `createWidgetComponent` line per element — the `@gtkx/react` factory
 * resolves the element's slot surface at runtime from the merged tables in
 * `virtual:gtkx-config` — wrapped in the matching `@gtkx/react` HOC for
 * behavior-carrying hosts (windows, applications, dialog buttons, actions),
 * plus one flat component per metadata-child kind whose parent lives in this
 * namespace (`GtkStackPage`, …).
 *
 * HOC and factory value imports, `react` builtins, and shared virtual prop
 * types accumulate into `imports`; compound prop types resolve locally
 * because the intrinsic section of the same module declares them.
 *
 * @param targetNamespace - The namespace this module is generated for
 * @param repository - The loaded GIR repository
 * @param options - The shared import accumulator and the widget names a
 *   hand-written component owns (skipped here)
 */
export const generateCompoundsSection = (
    targetNamespace: GirNamespace,
    repository: GirRepository,
    options: {
        readonly imports: JsxImports;
        readonly excludeNames: ReadonlySet<string>;
    },
): { readonly source: string; readonly exportedNames: ReadonlySet<string> } => {
    const { imports, excludeNames } = options;
    const exportedNames = new Set<string>();
    const exportLines: string[] = [];
    let needsWrapperConst = false;

    const virtuals = virtualSubcomponentsForNamespace(targetNamespace, repository);
    const virtualNames = new Set(virtuals.map((virtual) => virtual.flatName));

    for (const candidate of collectReactNodeClasses(repository)) {
        if (candidate.namespace.name !== targetNamespace.name) continue;
        if (excludeNames.has(candidate.glibName) || virtualNames.has(candidate.glibName)) continue;
        const { glibName, klass, namespace } = candidate;
        const hoc = compoundHoc(klass, namespace, repository);
        imports.hocs.add("createWidgetComponent");
        imports.reactBuiltins.add("ReactNode");
        if (hoc !== undefined) imports.hocs.add(hoc);
        exportLines.push(renderCompound(glibName, hoc));
        exportedNames.add(glibName);
    }

    for (const virtual of virtuals) {
        needsWrapperConst = true;
        imports.sharedTypes.add(virtual.propsType);
        imports.reactBuiltins.add("ReactNode");
        exportLines.push(renderVirtualSubcomponent(virtual));
        exportedNames.add(virtual.flatName);
    }

    const sections = [
        needsWrapperConst ? `const ${WRAPPER_ELEMENT_CONST} = ${quote(WRAPPER_NODE_ELEMENT)} as const;` : "",
        exportLines.join("\n\n"),
    ];
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

const renderCompound = (glibName: string, hoc: CompoundHoc | undefined): string => {
    const propsType = `${glibName}Props`;
    if (hoc === undefined) {
        return `export const ${glibName}: (props: ${propsType}) => ReactNode = createWidgetComponent<${propsType}>(${quote(glibName)});`;
    }
    const componentPropsType =
        hoc === "withApplication" ? `Omit<${propsType}, "menubar"> & { menubar?: ReactNode }` : propsType;
    const annotation = `(props: ${componentPropsType}) => ReactNode`;
    const memo = `${toCamelCase(glibName)}Instance`;
    return [
        `let ${memo}: (${annotation}) | undefined;`,
        `export const ${glibName}: ${annotation} = (props) => (${memo} ??= ${hoc}<${componentPropsType}>(createWidgetComponent<${componentPropsType}>(${quote(glibName)})))(props);`,
    ].join("\n");
};

/**
 * Emits the conditional inert wrapper child for a positionally-consumed slot:
 * `{prop != null && <WrapperNodeElement kind="...">{prop}</WrapperNodeElement>}`.
 * It carries no target attribute, because the enclosing meta-object reads
 * this wrapper's child by position instead of setting a property from it.
 *
 * @param kind - The wrapper kind the child is emitted with.
 * @param prop - The prop name carrying the `ReactNode`.
 */
const renderPositionalSlotChild = (kind: string, prop: string): string =>
    `{${prop} != null && <${WRAPPER_ELEMENT_CONST} kind=${quote(kind)}>{${prop}}</${WRAPPER_ELEMENT_CONST}>}`;

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
        return `export const ${flatName} = (props: ${propsType}): ReactNode => (\n    <${WRAPPER_ELEMENT_CONST} kind=${quote(kind)} {...props} />\n);`;
    }
    return [
        `export const ${flatName} = (props: ${propsType}): ReactNode => {`,
        `    const { ${slot.prop}, children, ...rest } = props;`,
        "    return (",
        `        <${WRAPPER_ELEMENT_CONST} kind=${quote(kind)} {...rest}>`,
        "            {children}",
        `            ${renderPositionalSlotChild(slot.kind, slot.prop)}`,
        `        </${WRAPPER_ELEMENT_CONST}>`,
        "    );",
        "};",
    ].join("\n");
};
