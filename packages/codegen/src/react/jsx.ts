import { quote } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import { splitQualifiedName } from "../gir/qualified-name.js";
import type { GirRepository } from "../gir/repository.js";
import { containerSlotsFor } from "./compounds-meta.js";
import { buildWidgetPropsEntries } from "./props.js";
import { isReactNodeClass, iterateClassesWithGlibName, type WidgetCandidate } from "./widgets.js";

type WidgetEntry = WidgetCandidate;

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
 * @param slotPropMap - Per-widget slot prop name overrides
 */
export const generateJsx = (
    repository: GirRepository,
    excludeNames: ReadonlySet<string> = new Set(),
    slotPropMap: Readonly<Record<string, readonly string[]>> = {},
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
    const propBlocks: string[] = ["export interface WidgetProps {\n    name?: string;\n}"];
    for (const entry of widgets) {
        const block = buildPropBlock(repository, entry, {
            slotPropMap,
            isWidgetAncestor,
            widgetByGlibName,
            namespaceImports,
        });
        propBlocks.push(block);
    }

    const importLines = buildImportLines(namespaceImports);
    const slotEntries = widgets.map((entry) => `    readonly ${quote(entry.glibName)}: string`);
    const slotNamesLine = `export type WidgetSlotNames = {\n${slotEntries.join(";\n")};\n};`;
    const intrinsicEntries = widgets.map((entry) => `        ${entry.glibName}: ${entry.glibName}Props;`);
    const jsxAugmentation = [
        "declare global {",
        "    namespace React.JSX {",
        "        interface IntrinsicElements {",
        ...intrinsicEntries,
        "        }",
        "    }",
        "}",
    ].join("\n");
    const body = [
        importLines.join("\n"),
        "",
        constLines.join("\n"),
        "",
        propBlocks.join("\n\n"),
        "",
        slotNamesLine,
        "",
        jsxAugmentation,
    ].join("\n");
    return `${body}\n`;
};

type BuildPropBlockContext = {
    readonly slotPropMap: Readonly<Record<string, readonly string[]>>;
    readonly isWidgetAncestor: (candidate: GirClass) => boolean;
    readonly widgetByGlibName: ReadonlyMap<string, WidgetEntry>;
    readonly namespaceImports: Map<string, string>;
};

const buildPropBlock = (repository: GirRepository, entry: WidgetEntry, ctx: BuildPropBlockContext): string => {
    const slotPropNames = new Set(ctx.slotPropMap[entry.glibName] ?? []);
    const { propLines, imports } = buildWidgetPropsEntries({
        repository,
        klass: entry.klass,
        slotPropNames,
        isWidgetAncestor: ctx.isWidgetAncestor,
    });
    for (const [namespace, alias] of imports) ctx.namespaceImports.set(namespace, alias);
    ctx.namespaceImports.set(entry.namespace.name, entry.namespace.name);
    const widgetTypeRef = `${entry.namespace.name}.${entry.klass.name} | null`;
    const ownerLines = [
        "    children?: ReactNode;",
        `    ref?: Ref<${widgetTypeRef}>;`,
        ...propLines.map((line) => `    ${line}`),
        ...containerSlotsFor(entry.glibName).map((method) => `    ${method}?: ReactNode | null;`),
    ];
    const parentExtends = resolveParentPropsExtension(repository, entry, ctx.widgetByGlibName);
    return `export interface ${entry.glibName}Props extends ${parentExtends} {\n${ownerLines.join("\n")}\n}`;
};

const buildImportLines = (namespaceImports: ReadonlyMap<string, string>): readonly string[] => {
    const lines = ['import type { ReactNode, Ref } from "react";'];
    for (const [namespaceName, alias] of namespaceImports) {
        if (namespaceName === "") continue;
        const directory = namespaceName.toLowerCase();
        lines.push(`import type * as ${alias} from "${ffiImportPath(directory)}";`);
    }
    return lines;
};

const collectWidgets = (repository: GirRepository): readonly WidgetEntry[] => {
    const entries: WidgetEntry[] = [];
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

const ffiImportPath = (directory: string): string => `@gtkx/ffi/${directory}`;

const resolveParentPropsExtension = (
    repository: GirRepository,
    entry: WidgetEntry,
    widgetByGlibName: ReadonlyMap<string, WidgetEntry>,
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
    return `${parentGlib}Props`;
};
