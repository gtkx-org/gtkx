import { quote } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import { splitQualifiedName } from "../gir/qualified-name.js";
import type { GirRepository } from "../gir/repository.js";
import { buildWidgetPropsEntries } from "./props.js";
import { isReactNodeClass, iterateClassesWithGlibName, type WidgetCandidate } from "./widgets.js";

/**
 * Generates `jsx.ts` source — one `export const Name = "Name"` per JSX
 * intrinsic element (every GtkWidget descendant plus event controllers
 * and layout managers) that is NOT exported as a slot-widget compound,
 * plus an `export type NameProps` permissive prop bag per intrinsic and
 * a `WidgetSlotNames` index of every widget's allowed slot names.
 *
 * Compounds.ts owns its widgets' runtime exports. To prevent ambiguous
 * re-exports when consumers wildcard both `compounds.js` and `jsx.js`,
 * widgets covered by `excludeNames` are skipped here and the consumer
 * sees a single function-typed export from compounds instead of the
 * string-literal constant. Prop types are still emitted for every
 * widget — they live in the type namespace and never clash with
 * compounds.
 *
 * @param repository - The loaded GIR repository
 * @param excludeNames - Widgets already exported by `compounds.ts`
 * @param maps - Merged widget-slot, container-slot, and array-prop maps keyed by JSX element name
 */
export const generateJsx = (
    repository: GirRepository,
    excludeNames: ReadonlySet<string> = new Set(),
    maps: JsxSurfaceMaps = {},
): string => {
    const widgets = collectWidgets(repository);
    const intrinsicWidgets = widgets.filter((entry) => !excludeNames.has(entry.glibName));
    const constLines = intrinsicWidgets.map(
        (entry) => `export const ${entry.glibName} = ${quote(entry.glibName)} as const;`,
    );

    const widgetByGlibName = new Map(widgets.map((entry) => [entry.glibName, entry]));
    const isWidgetAncestor = (candidate: GirClass): boolean => {
        const candidateGlib = candidate.glibTypeName ?? candidate.cType;
        return candidateGlib !== undefined && widgetByGlibName.has(candidateGlib);
    };
    const namespaceImports = new Map<string, string>();
    const referencedItemTypes = new Set<string>();
    const propBlocks: string[] = ["export interface WidgetProps {\n    name?: string;\n}"];
    for (const entry of widgets) {
        propBlocks.push(
            renderPropBlock(repository, entry, {
                widgetSlotMap: maps.widgetSlotMap ?? {},
                containerSlotMap: maps.containerSlotMap ?? {},
                arrayPropMap: maps.arrayPropMap ?? {},
                isWidgetAncestor,
                widgetByGlibName,
                namespaceImports,
                referencedItemTypes,
            }),
        );
    }

    const body = [
        renderImportLines(namespaceImports, referencedItemTypes).join("\n"),
        "",
        constLines.join("\n"),
        "",
        propBlocks.join("\n\n"),
        "",
        renderSlotNamesLine(widgets, maps.widgetSlotMap ?? {}),
        "",
        renderJsxAugmentation(widgets),
    ].join("\n");
    return `${body}\n`;
};

/** Merged JSX-surface maps keyed by JSX element name, threaded into {@link generateJsx}. */
type JsxSurfaceMaps = {
    /** Widget-slot names keyed by JSX element name. */
    readonly widgetSlotMap?: Readonly<Record<string, readonly string[]>>;
    /** Container-slot methods keyed by JSX element name. */
    readonly containerSlotMap?: Readonly<Record<string, readonly string[]>>;
    /** Array props keyed by JSX element name then prop name to item-type name. */
    readonly arrayPropMap?: Readonly<Record<string, Readonly<Record<string, string>>>>;
};

const renderSlotNamesLine = (
    widgets: readonly WidgetCandidate[],
    widgetSlotMap: Readonly<Record<string, readonly string[]>>,
): string => {
    const slotEntries = widgets.map((entry) => {
        const slots = widgetSlotMap[entry.glibName] ?? [];
        const slotType = slots.length === 0 ? "string" : slots.map((slot) => quote(slot)).join(" | ");
        return `    readonly ${quote(entry.glibName)}: ${slotType}`;
    });
    return `export type WidgetSlotNames = {\n${slotEntries.join(";\n")};\n};`;
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

type RenderPropBlockContext = {
    readonly widgetSlotMap: Readonly<Record<string, readonly string[]>>;
    readonly containerSlotMap: Readonly<Record<string, readonly string[]>>;
    readonly arrayPropMap: Readonly<Record<string, Readonly<Record<string, string>>>>;
    readonly isWidgetAncestor: (candidate: GirClass) => boolean;
    readonly widgetByGlibName: ReadonlyMap<string, WidgetCandidate>;
    readonly namespaceImports: Map<string, string>;
    readonly referencedItemTypes: Set<string>;
};

const renderPropBlock = (
    repository: GirRepository,
    entry: WidgetCandidate,
    context: RenderPropBlockContext,
): string => {
    const slotPropNames = new Set(context.widgetSlotMap[entry.glibName] ?? []);
    const arrayProps = context.arrayPropMap[entry.glibName] ?? {};
    const { propLines, imports } = buildWidgetPropsEntries({
        repository,
        klass: entry.klass,
        slotPropNames,
        arrayPropNames: new Set(Object.keys(arrayProps)),
        isWidgetAncestor: context.isWidgetAncestor,
    });
    for (const [namespace, alias] of imports) context.namespaceImports.set(namespace, alias);
    context.namespaceImports.set(entry.namespace.name, entry.namespace.name);
    const widgetTypeRef = `${entry.namespace.name}.${entry.klass.name} | null`;
    const arrayPropLines = Object.entries(arrayProps).map(([propName, itemType]) => {
        context.referencedItemTypes.add(itemType);
        return `    ${propName}?: ${itemType}[] | null;`;
    });
    const ownerLines = [
        "    children?: ReactNode;",
        `    ref?: Ref<${widgetTypeRef}>;`,
        ...propLines.map((line) => `    ${line}`),
        ...(context.containerSlotMap[entry.glibName] ?? []).map((method) => `    ${method}?: ReactNode | null;`),
        ...arrayPropLines,
    ];
    const parentExtends = resolveParentPropsExtension(repository, entry, context.widgetByGlibName);
    const selfDefault = `${entry.namespace.name}.${entry.klass.name}`;
    return `export interface ${entry.glibName}Props<Self = ${selfDefault}> extends ${parentExtends} {\n${ownerLines.join("\n")}\n}`;
};

const renderImportLines = (
    namespaceImports: ReadonlyMap<string, string>,
    referencedItemTypes: ReadonlySet<string>,
): readonly string[] => {
    const lines = ['import type { ReactNode, Ref } from "react";'];
    if (referencedItemTypes.size > 0) {
        const names = [...referencedItemTypes].sort((a, b) => a.localeCompare(b));
        lines.push(`import type { ${names.join(", ")} } from "@gtkx/react";`);
    }
    for (const [namespaceName, alias] of namespaceImports) {
        if (namespaceName === "") continue;
        const directory = namespaceName.toLowerCase();
        lines.push(`import type * as ${alias} from "${ffiImportPath(directory)}";`);
    }
    return lines;
};

const collectWidgets = (repository: GirRepository): readonly WidgetCandidate[] => {
    const entries: WidgetCandidate[] = [];
    const seen = new Set<string>();
    for (const candidate of iterateClassesWithGlibName(repository)) {
        const { glibName, klass, namespace } = candidate;
        if (!isReactNodeClass(klass, namespace, repository)) continue;
        if (seen.has(glibName)) continue;
        seen.add(glibName);
        entries.push(candidate);
    }
    return entries.sort((a, b) => a.glibName.localeCompare(b.glibName));
};

const ffiImportPath = (directory: string): string => `@gtkx/gi/${directory}`;

const resolveParentPropsExtension = (
    repository: GirRepository,
    entry: WidgetCandidate,
    widgetByGlibName: ReadonlyMap<string, WidgetCandidate>,
): string => {
    const parent = entry.klass.parent;
    if (parent === undefined) return "WidgetProps";
    const { namespaceName, typeName } = splitQualifiedName(parent, entry.namespace.name);
    const resolved = repository.resolveNamed(namespaceName, typeName);
    if (resolved === undefined) return "WidgetProps";
    if (resolved.kind !== "class" && resolved.kind !== "interface") return "WidgetProps";
    const parentGlib = resolved.value.glibTypeName ?? resolved.value.cType;
    if (parentGlib === undefined) return "WidgetProps";
    if (!widgetByGlibName.has(parentGlib)) return "WidgetProps";
    return `${parentGlib}Props<Self>`;
};
