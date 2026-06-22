import type { ArrayPropRow, ContainerPropRow, ObjectPropRow, PerElementPropRows, VirtualPropRow } from "@gtkx/config";
import { quote } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirRepository } from "../gir/repository.js";
import { splitOptionalNamespace } from "../gir/type-ref.js";
import type { JsxImports } from "./imports.js";
import { buildWidgetPropsEntries } from "./props.js";
import { BUILT_IN_PROPS_MIXINS, WIDGET_BASE_PROPS_MIXINS } from "./tables.js";
import { collectReactNodeClasses, type WidgetCandidate } from "./widgets.js";

export type JsxSurfaceMaps = {
    containerPropMap?: PerElementPropRows<ContainerPropRow>;
    arrayPropMap?: PerElementPropRows<ArrayPropRow>;
    objectPropMap?: PerElementPropRows<ObjectPropRow>;
    virtualPropMap?: PerElementPropRows<VirtualPropRow>;
};

export const generateJsxSection = (
    targetNamespace: GirNamespace,
    repository: GirRepository,
    options: {
        excludeNames: Set<string>;
        maps: JsxSurfaceMaps;
        imports: JsxImports;
    },
): { source: string; intrinsicCount: number } => {
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
    let needsReactElement = false;
    const propBlocks: string[] = [];
    for (const entry of widgets) {
        const { block, extendsBase, slotPropNames } = renderPropBlock(repository, entry, {
            containerPropMap: maps.containerPropMap ?? {},
            arrayPropMap: maps.arrayPropMap ?? {},
            objectPropMap: maps.objectPropMap ?? {},
            virtualPropMap: maps.virtualPropMap ?? {},
            isWidgetAncestor,
            widgetByGlibName,
            targetNamespaceName: targetNamespace.name,
            imports,
        });
        if (extendsBase) needsWidgetPropsBase = true;
        if (slotPropNames.length > 0) needsReactElement = true;
        propBlocks.push(block);
    }
    if (needsReactElement) imports.reactBuiltins.add("ReactElement");
    if (needsWidgetPropsBase) {
        for (const mixin of WIDGET_BASE_PROPS_MIXINS) imports.sharedTypes.add(mixin);
        propBlocks.unshift(
            `export interface WidgetProps extends ${WIDGET_BASE_PROPS_MIXINS.join(", ")} {\n    name?: string;\n}`,
        );
    }

    const source = [constLines.join("\n"), "", propBlocks.join("\n\n"), "", renderJsxAugmentation(widgets)].join("\n");
    return { source, intrinsicCount: intrinsicWidgets.length };
};

const renderJsxAugmentation = (widgets: WidgetCandidate[]): string =>
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
    isWidgetAncestor: (candidate: GirClass) => boolean;
    widgetByGlibName: Map<string, WidgetCandidate>;
    targetNamespaceName: string;
    imports: JsxImports;
};

const renderPropBlock = (
    repository: GirRepository,
    entry: WidgetCandidate,
    context: RenderPropBlockContext,
): { block: string; extendsBase: boolean; slotPropNames: string[] } => {
    const arrayProps = context.arrayPropMap[entry.glibName] ?? {};
    const objectProps = context.objectPropMap[entry.glibName] ?? {};
    const virtualProps = context.virtualPropMap[entry.glibName] ?? {};
    const { propLines, imports, slotPropNames } = buildWidgetPropsEntries({
        repository,
        klass: entry.klass,
        namespace: entry.namespace,
        dataPropNames: new Set([...Object.keys(arrayProps), ...Object.keys(objectProps), ...Object.keys(virtualProps)]),
        isWidgetAncestor: context.isWidgetAncestor,
    });
    for (const [namespace, alias] of imports) context.imports.giNamespaces.set(namespace, alias);
    context.imports.giNamespaces.set(entry.namespace.name, entry.namespace.name);
    const widgetTypeRef = `${entry.namespace.name}.${entry.klass.name} | null`;
    const resolveItemType = (itemType: string): string => {
        const [namespace] = splitOptionalNamespace(itemType);
        if (namespace === undefined) {
            context.imports.sharedTypes.add(itemType);
        } else {
            context.imports.giNamespaces.set(namespace, namespace);
        }
        return itemType;
    };
    const arrayPropLines = Object.entries(arrayProps).map(
        ([propName, row]) => `    ${propName}?: ${resolveItemType(row.itemType)}[] | null | undefined;`,
    );
    const objectPropLines = Object.entries(objectProps).map(
        ([propName, row]) => `    ${propName}?: ${resolveItemType(row.itemType)} | null | undefined;`,
    );
    const virtualPropLines = Object.entries(virtualProps).map(([propName, row]) => {
        const [namespace] = splitOptionalNamespace(row.type);
        if (namespace) context.imports.giNamespaces.set(namespace, namespace);
        return `    ${propName}?: ${row.type} | null | undefined;`;
    });
    const ownerLines = [
        "    children?: ReactNode;",
        `    ref?: Ref<${widgetTypeRef}> | undefined;`,
        ...propLines.map((line) => `    ${line}`),
        ...Object.keys(context.containerPropMap[entry.glibName] ?? {}).map(
            (propName) => `    ${propName}?: ReactNode | null | undefined;`,
        ),
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
        slotPropNames,
    };
};

const resolveParentPropsExtension = (
    repository: GirRepository,
    entry: WidgetCandidate,
    context: RenderPropBlockContext,
): string => {
    const parent = entry.klass.parent;
    if (parent === undefined) return "WidgetProps";
    const resolved = repository.resolveType(entry.namespace.name, parent);
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
