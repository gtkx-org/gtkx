import type { ArrayPropRow, ObjectPropRow, VirtualPropRow } from "@gtkx/config";
import { quote } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirNamespace } from "../gir/namespace.js";
import { splitQualifiedName } from "../gir/qualified-name.js";
import type { GirRepository } from "../gir/repository.js";
import type { JsxImports } from "./imports.js";
import { buildWidgetPropsEntries } from "./props.js";
import { BUILT_IN_PROPS_MIXINS, WIDGET_BASE_PROPS_MIXINS } from "./tables.js";
import { collectReactNodeClasses, type WidgetCandidate } from "./widgets.js";

/** Merged JSX-surface maps keyed by JSX element name, threaded into {@link generateJsxSection}. */
export type JsxSurfaceMaps = {
    /** Widget-slot names keyed by JSX element name. */
    readonly widgetSlotMap?: Readonly<Record<string, readonly string[]>>;
    /** Container-slot methods keyed by JSX element name. */
    readonly containerSlotMap?: Readonly<Record<string, readonly string[]>>;
    /** Array-prop rows keyed by JSX element name then prop name. */
    readonly arrayPropMap?: Readonly<Record<string, Readonly<Record<string, ArrayPropRow>>>>;
    /** Object-prop rows keyed by JSX element name then prop name. */
    readonly objectPropMap?: Readonly<Record<string, Readonly<Record<string, ObjectPropRow>>>>;
    /** Virtual-prop rows keyed by JSX element name then prop name. */
    readonly virtualPropMap?: Readonly<Record<string, Readonly<Record<string, VirtualPropRow>>>>;
};

/**
 * Generates the intrinsic/Props section of one namespace's `@gtkx/jsx`
 * module: one `export const Name = "Name"` per JSX intrinsic element NOT exported
 * as a compound, an `export interface NameProps` per intrinsic, the synthetic
 * `WidgetProps` base when this namespace owns the root of the prop chain, and
 * the `React.JSX.IntrinsicElements` augmentation — each scoped to the target
 * namespace's widgets.
 *
 * Parent-prop inheritance resolves against the full repository, so a widget whose
 * parent lives in another namespace records a cross-namespace `Props` import into
 * `imports`; same-namespace parents resolve locally. Every other import need
 * (`react` builtins, GIR namespace aliases, shared item types) is accumulated
 * into `imports` for the pipeline to render once.
 *
 * @param targetNamespace - The namespace this module is generated for
 * @param repository - The loaded GIR repository
 * @param options - The compound-exported names to skip, the merged slot/array-prop
 *   maps, and the shared import accumulator the section populates
 */
export const generateJsxSection = (
    targetNamespace: GirNamespace,
    repository: GirRepository,
    options: {
        readonly excludeNames: ReadonlySet<string>;
        readonly maps: JsxSurfaceMaps;
        readonly imports: JsxImports;
    },
): string => {
    const { excludeNames, maps, imports } = options;
    const allWidgets = collectReactNodeClasses(repository);
    const widgets = allWidgets.filter((entry) => entry.namespace.name === targetNamespace.name);
    const intrinsicWidgets = widgets.filter((entry) => !excludeNames.has(entry.glibName));
    const constLines = intrinsicWidgets.map(
        (entry) => `export const ${entry.glibName} = ${quote(entry.glibName)} as const;`,
    );

    const widgetByGlibName = new Map(allWidgets.map((entry) => [entry.glibName, entry]));
    const isWidgetAncestor = (candidate: GirClass): boolean => {
        const candidateGlib = candidate.glibTypeName ?? candidate.cType;
        return candidateGlib !== undefined && widgetByGlibName.has(candidateGlib);
    };
    imports.reactBuiltins.add("ReactNode");
    imports.reactBuiltins.add("Ref");

    let needsWidgetPropsBase = false;
    const propBlocks: string[] = [];
    for (const entry of widgets) {
        const { block, extendsBase } = renderPropBlock(repository, entry, {
            widgetSlotMap: maps.widgetSlotMap ?? {},
            containerSlotMap: maps.containerSlotMap ?? {},
            arrayPropMap: maps.arrayPropMap ?? {},
            objectPropMap: maps.objectPropMap ?? {},
            virtualPropMap: maps.virtualPropMap ?? {},
            isWidgetAncestor,
            widgetByGlibName,
            targetNamespaceName: targetNamespace.name,
            imports,
        });
        if (extendsBase) needsWidgetPropsBase = true;
        propBlocks.push(block);
    }
    if (needsWidgetPropsBase) {
        for (const mixin of WIDGET_BASE_PROPS_MIXINS) imports.sharedTypes.add(mixin);
        propBlocks.unshift(
            `export interface WidgetProps extends ${WIDGET_BASE_PROPS_MIXINS.join(", ")} {\n    name?: string;\n}`,
        );
    }

    return [constLines.join("\n"), "", propBlocks.join("\n\n"), "", renderJsxAugmentation(widgets)].join("\n");
};

const renderJsxAugmentation = (widgets: readonly WidgetCandidate[]): string =>
    [
        "declare global {",
        "    namespace React.JSX {",
        "        interface IntrinsicElements {",
        ...widgets.map((entry) => `        ${entry.glibName}: ${entry.glibName}Props;`),
        "        }",
        "    }",
        "}",
    ].join("\n");

type RenderPropBlockContext = Required<JsxSurfaceMaps> & {
    readonly isWidgetAncestor: (candidate: GirClass) => boolean;
    readonly widgetByGlibName: ReadonlyMap<string, WidgetCandidate>;
    readonly targetNamespaceName: string;
    readonly imports: JsxImports;
};

const renderPropBlock = (
    repository: GirRepository,
    entry: WidgetCandidate,
    context: RenderPropBlockContext,
): { readonly block: string; readonly extendsBase: boolean } => {
    const slotPropNames = new Set(context.widgetSlotMap[entry.glibName] ?? []);
    const arrayProps = context.arrayPropMap[entry.glibName] ?? {};
    const objectProps = context.objectPropMap[entry.glibName] ?? {};
    const virtualProps = context.virtualPropMap[entry.glibName] ?? {};
    const { propLines, imports } = buildWidgetPropsEntries({
        repository,
        klass: entry.klass,
        slotPropNames,
        dataPropNames: new Set([...Object.keys(arrayProps), ...Object.keys(objectProps), ...Object.keys(virtualProps)]),
        isWidgetAncestor: context.isWidgetAncestor,
    });
    for (const [namespace, alias] of imports) context.imports.giNamespaces.set(namespace, alias);
    context.imports.giNamespaces.set(entry.namespace.name, entry.namespace.name);
    const widgetTypeRef = `${entry.namespace.name}.${entry.klass.name} | null`;
    const resolveItemType = (itemType: string): string => {
        const dotIndex = itemType.indexOf(".");
        if (dotIndex === -1) {
            context.imports.sharedTypes.add(itemType);
        } else {
            const namespace = itemType.slice(0, dotIndex);
            context.imports.giNamespaces.set(namespace, namespace);
        }
        return itemType;
    };
    const arrayPropLines = Object.entries(arrayProps).map(
        ([propName, row]) => `    ${propName}?: ${resolveItemType(row.itemType)}[] | null;`,
    );
    const objectPropLines = Object.entries(objectProps).map(
        ([propName, row]) => `    ${propName}?: ${resolveItemType(row.itemType)} | null;`,
    );
    const virtualPropLines = Object.entries(virtualProps).map(([propName, row]) => {
        const [namespace] = row.type.split(".");
        if (namespace) context.imports.giNamespaces.set(namespace, namespace);
        return `    ${propName}?: ${row.type} | null;`;
    });
    const ownerLines = [
        "    children?: ReactNode;",
        `    ref?: Ref<${widgetTypeRef}>;`,
        ...propLines.map((line) => `    ${line}`),
        ...(context.containerSlotMap[entry.glibName] ?? []).map((method) => `    ${method}?: ReactNode | null;`),
        ...arrayPropLines,
        ...objectPropLines,
        ...virtualPropLines,
    ];
    const parentExtends = resolveParentPropsExtension(repository, entry, context);
    const mixins = BUILT_IN_PROPS_MIXINS[entry.glibName] ?? [];
    for (const mixin of mixins) context.imports.sharedTypes.add(mixin);
    const extendsClause = [parentExtends, ...mixins].join(", ");
    const selfDefault = `${entry.namespace.name}.${entry.klass.name}`;
    return {
        block: `export interface ${entry.glibName}Props<Self = ${selfDefault}> extends ${extendsClause} {\n${ownerLines.join("\n")}\n}`,
        extendsBase: parentExtends === "WidgetProps",
    };
};

const resolveParentPropsExtension = (
    repository: GirRepository,
    entry: WidgetCandidate,
    context: RenderPropBlockContext,
): string => {
    const parent = entry.klass.parent;
    if (parent === undefined) return "WidgetProps";
    const { namespaceName, typeName } = splitQualifiedName(parent, entry.namespace.name);
    const resolved = repository.resolveNamed(namespaceName, typeName);
    if (resolved === undefined) return "WidgetProps";
    if (resolved.kind !== "class" && resolved.kind !== "interface") return "WidgetProps";
    const parentGlib = resolved.value.glibTypeName ?? resolved.value.cType;
    if (parentGlib === undefined) return "WidgetProps";
    if (!context.widgetByGlibName.has(parentGlib)) return "WidgetProps";
    const parentNamespaceName = resolved.namespace.name;
    if (parentNamespaceName !== context.targetNamespaceName) {
        const directory = parentNamespaceName.toLowerCase();
        const names = context.imports.crossNsProps.get(directory) ?? new Set<string>();
        names.add(`${parentGlib}Props`);
        context.imports.crossNsProps.set(directory, names);
    }
    return `${parentGlib}Props<Self>`;
};
