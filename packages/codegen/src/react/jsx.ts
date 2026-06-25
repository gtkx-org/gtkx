import { sourceStringLiteral } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { Library } from "../gir/library.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { JsxImports } from "./imports.js";
import { collectIntrinsicElementClasses, type IntrinsicElementClass } from "./intrinsic-elements.js";
import { buildElementPropsEntries } from "./props.js";
import { ACCESSIBLE_PROP_TYPES, SLOT_PROPS_BY_TYPE } from "./tables.js";

export type GenerateJsxOptions = {
    excludeNames: Set<string>;
    imports: JsxImports;
};

const QUALIFIED_TYPE_PATTERN = /^[A-Z][A-Za-z0-9]*\.[A-Z]/;

export const generateJsxSection = (
    targetNamespace: GirNamespace,
    library: Library,
    options: GenerateJsxOptions,
): { source: string; intrinsicCount: number } => {
    const { excludeNames, imports } = options;
    const allWidgets = collectIntrinsicElementClasses(library);
    const widgets = allWidgets.filter((entry) => entry.namespace.name === targetNamespace.name);
    const intrinsicWidgets = widgets.filter((entry) => !excludeNames.has(entry.glibName));
    const constLines = intrinsicWidgets.map(
        (entry) => `export const ${entry.glibName} = ${sourceStringLiteral(entry.glibName)} as const;`,
    );

    const intrinsicElementByGlibName = new Map(allWidgets.map((entry) => [entry.glibName, entry]));
    const isIntrinsicElementAncestor = (candidate: GirClass): boolean => {
        const candidateGlib = candidate.glibTypeName ?? candidate.cType;
        return candidateGlib !== undefined && intrinsicElementByGlibName.has(candidateGlib);
    };
    imports.reactBuiltins.add("ReactNode");
    imports.reactBuiltins.add("Ref");

    let needsIntrinsicElementPropsBase = false;
    let needsReactElement = false;
    const propBlocks: string[] = [];
    for (const entry of widgets) {
        const { block, extendsBase, slotPropNames } = renderPropBlock(library, entry, {
            isIntrinsicElementAncestor,
            intrinsicElementByGlibName,
            targetNamespaceName: targetNamespace.name,
            imports,
        });
        if (extendsBase) needsIntrinsicElementPropsBase = true;
        if (slotPropNames.length > 0) needsReactElement = true;
        propBlocks.push(block);
    }
    if (needsReactElement) imports.reactBuiltins.add("ReactElement");
    if (needsIntrinsicElementPropsBase) propBlocks.unshift(renderWidgetPropsBase(imports));

    const source = [constLines.join("\n"), "", propBlocks.join("\n\n"), "", renderJsxAugmentation(widgets)].join("\n");
    return { source, intrinsicCount: intrinsicWidgets.length };
};

const renderWidgetPropsBase = (imports: JsxImports): string => {
    const accessibleLines = Object.entries(ACCESSIBLE_PROP_TYPES).map(([name, tsType]) => {
        const namespace = tsType.split(".")[0];
        if (QUALIFIED_TYPE_PATTERN.test(tsType) && namespace !== undefined) {
            imports.giNamespaces.set(namespace, namespace);
        }
        return `    ${name}?: ${tsType} | null | undefined;`;
    });
    return ["export interface WidgetProps {", "    name?: string;", ...accessibleLines, "}"].join("\n");
};

const renderJsxAugmentation = (widgets: IntrinsicElementClass[]): string =>
    [
        "declare global {",
        "    namespace React.JSX {",
        "        interface IntrinsicElements {",
        ...widgets.map((entry) => `        ${entry.glibName}: ${entry.glibName}Props;`),
        "        }",
        "    }",
        "}",
    ].join("\n");

type RenderPropBlockContext = {
    isIntrinsicElementAncestor: (candidate: GirClass) => boolean;
    intrinsicElementByGlibName: Map<string, IntrinsicElementClass>;
    targetNamespaceName: string;
    imports: JsxImports;
};

const renderPropBlock = (
    library: Library,
    entry: IntrinsicElementClass,
    context: RenderPropBlockContext,
): { block: string; extendsBase: boolean; slotPropNames: string[] } => {
    const slotProps = SLOT_PROPS_BY_TYPE[entry.glibName] ?? [];
    const { propLines, imports, slotPropNames } = buildElementPropsEntries({
        library,
        klass: entry.klass,
        namespace: entry.namespace,
        isIntrinsicElementAncestor: context.isIntrinsicElementAncestor,
    });
    for (const [namespace, alias] of imports) context.imports.giNamespaces.set(namespace, alias);
    context.imports.giNamespaces.set(entry.namespace.name, entry.namespace.name);
    const widgetTypeRef = `${entry.namespace.name}.${entry.klass.name} | null`;
    const slotPropLines = slotProps.map((propName) => `    ${propName}?: ReactNode | null | undefined;`);
    const ownerLines = [
        "    children?: ReactNode;",
        `    ref?: Ref<${widgetTypeRef}> | undefined;`,
        ...propLines.map((line) => `    ${line}`),
        ...slotPropLines,
    ];
    const parentExtends = resolveParentPropsExtension(library, entry, context);
    const selfDefault = `${entry.namespace.name}.${entry.klass.name}`;
    return {
        block: `export interface ${entry.glibName}Props<Self = ${selfDefault}> extends ${parentExtends} {\n${ownerLines.join("\n")}\n}`,
        extendsBase: parentExtends === "WidgetProps",
        slotPropNames,
    };
};

const resolveParentPropsExtension = (
    library: Library,
    entry: IntrinsicElementClass,
    context: RenderPropBlockContext,
): string => {
    const parent = entry.klass.parent;
    if (parent === undefined) return "WidgetProps";
    const resolved = library.resolveType(entry.namespace.name, parent);
    if (resolved === undefined) return "WidgetProps";
    if (resolved.kind !== "class" && resolved.kind !== "interface") return "WidgetProps";
    const parentGlib = resolved.value.glibTypeName ?? resolved.value.cType;
    if (parentGlib === undefined) return "WidgetProps";
    if (!context.intrinsicElementByGlibName.has(parentGlib)) return "WidgetProps";
    const parentNamespaceName = resolved.namespace.name;
    if (parentNamespaceName !== context.targetNamespaceName) {
        const directory = parentNamespaceName.toLowerCase();
        const names = context.imports.crossNsProps.get(directory) ?? new Set<string>();
        names.add(`${parentGlib}Props`);
        context.imports.crossNsProps.set(directory, names);
    }
    return `${parentGlib}Props<Self>`;
};
