import type { GirClass, GirInterface, GirNamespace, GirSignal, TypeMapper, TypeRegistry } from "@gtkx/gir";
import { toCamelCase, toPascalCase } from "@gtkx/gir";
import { format } from "prettier";

/**
 * Configuration options for the JSX type generator.
 */
interface JsxGeneratorOptions {
    /** Optional Prettier configuration for formatting output. */
    prettierConfig?: unknown;
}

/**
 * Result of the JSX generation containing both public and internal files.
 */
interface JsxGeneratorResult {
    /** Public JSX types and components for user consumption. */
    jsx: string;
    /** Internal metadata for reconciler use (not exported to users). */
    internal: string;
}

interface WidgetChildInfo {
    propertyName: string;
    slotName: string;
}

interface ContainerMetadata {
    supportsMultipleChildren: boolean;
    supportsSingleChild: boolean;
    namedChildSlots: WidgetChildInfo[];
}

interface WidgetInfo {
    widget: GirClass;
    namespace: string;
}

const LIST_WIDGETS = new Set(["ListView", "GridView"]);
const COLUMN_VIEW_WIDGET = "ColumnView";
const DROPDOWN_WIDGETS = new Set(["DropDown"]);
const GRID_WIDGETS = new Set(["Grid"]);
const NOTEBOOK_WIDGET = "Notebook";
const STACK_WIDGET = "Stack";
const POPOVER_MENU_WIDGET = "PopoverMenu";
const TOOLBAR_VIEW_WIDGET = "ToolbarView";

const INTERNALLY_PROVIDED_PARAMS: Record<string, Set<string>> = {
    ApplicationWindow: new Set(["application"]),
};

const WIDGET_REFERENCE_PROPERTIES = new Set(["mnemonic-widget"]);

const isPrimitive = (tsType: string): boolean => {
    const primitives = new Set(["boolean", "number", "string", "void", "unknown", "null", "undefined"]);
    return primitives.has(tsType);
};

const toJsxPropertyTypeBase = (tsType: string, namespace: string): string => {
    let result = tsType;

    if (result.startsWith("Ref<")) {
        result = result.replace(/^Ref<(.+)>$/, "$1");
    }

    if (isPrimitive(result)) return result;

    if (result.endsWith("[]")) {
        const elementType = result.slice(0, -2);
        if (isPrimitive(elementType)) return result;
    }

    if (result.includes(".") || result.includes("<") || result.includes("(")) return result;

    return `${namespace}.${result}`;
};

const isListWidget = (widgetName: string): boolean => LIST_WIDGETS.has(widgetName);
const isColumnViewWidget = (widgetName: string): boolean => widgetName === COLUMN_VIEW_WIDGET;
const isDropDownWidget = (widgetName: string): boolean => DROPDOWN_WIDGETS.has(widgetName);
const isGridWidget = (widgetName: string): boolean => GRID_WIDGETS.has(widgetName);
const isNotebookWidget = (widgetName: string): boolean => widgetName === NOTEBOOK_WIDGET;
const isStackWidget = (widgetName: string): boolean => widgetName === STACK_WIDGET;
const isPopoverMenuWidget = (widgetName: string): boolean => widgetName === POPOVER_MENU_WIDGET;
const isToolbarViewWidget = (widgetName: string): boolean => widgetName === TOOLBAR_VIEW_WIDGET;

const sanitizeDoc = (doc: string): string => {
    let result = doc;
    result = result.replace(/<picture[^>]*>[\s\S]*?<\/picture>/gi, "");
    result = result.replace(/<img[^>]*>/gi, "");
    result = result.replace(/<source[^>]*>/gi, "");
    result = result.replace(/!\[[^\]]*\]\([^)]+\.png\)/gi, "");
    result = result.replace(/<kbd>([^<]*)<\/kbd>/gi, "`$1`");
    result = result.replace(/<kbd>/gi, "`");
    result = result.replace(/<\/kbd>/gi, "`");
    result = result.replace(/\[([^\]]+)\]\([^)]+\.html[^)]*\)/gi, "$1");
    result = result.replace(/@(\w+)\s/g, "`$1` ");
    result = result.replace(/<(\/?)(child|object|property|signal|template)>/gi, "`<$1$2>`");
    return result.trim();
};

const formatDoc = (doc: string | undefined, indent: string = ""): string => {
    if (!doc) return "";
    const sanitized = sanitizeDoc(doc);
    if (!sanitized) return "";
    const lines = sanitized.split("\n").map((line) => line.trim());
    const firstLine = lines[0] ?? "";
    if (lines.length === 1 && firstLine.length < 80) {
        return `${indent}/** ${firstLine} */\n`;
    }
    const formattedLines = lines.map((line) => `${indent} * ${line}`);
    return `${indent}/**\n${formattedLines.join("\n")}\n${indent} */\n`;
};

const isWidgetSubclass = (
    typeName: string,
    classMap: Map<string, GirClass>,
    visited: Set<string> = new Set(),
): boolean => {
    const className = typeName.includes(".") ? typeName.split(".")[1] : typeName;
    if (!className || visited.has(className)) return false;
    visited.add(className);

    const cls = classMap.get(className);
    if (!cls) return false;
    if (className === "Widget") return true;

    return cls.parent ? isWidgetSubclass(cls.parent, classMap, visited) : false;
};

/**
 * Generates JSX type definitions for React components from GTK widget classes.
 * Creates TypeScript interfaces for props and augments React's JSX namespace.
 */
export class JsxGenerator {
    private interfaceMap: Map<string, GirInterface> = new Map();
    private usedNamespaces: Set<string> = new Set();
    private widgetPropertyNames: Set<string> = new Set();
    private widgetSignalNames: Set<string> = new Set();
    private currentNamespace = "";
    private widgetNamespaceMap: Map<string, string> = new Map();

    /**
     * Creates a new JSX generator.
     * @param typeMapper - TypeMapper for converting GIR types to TypeScript
     * @param typeRegistry - TypeRegistry for cross-namespace type resolution
     * @param classMap - Combined class map with fully qualified names
     * @param options - Generator configuration options
     */
    constructor(
        private typeMapper: TypeMapper,
        private typeRegistry: TypeRegistry,
        private classMap: Map<string, GirClass>,
        private options: JsxGeneratorOptions = {},
    ) {}

    /**
     * Generates JSX type definitions for all widgets in the given namespaces.
     * @param namespaces - The parsed GIR namespaces (GTK must be first)
     * @returns Generated TypeScript code as public jsx.ts and internal.ts files
     */
    async generate(namespaces: GirNamespace[]): Promise<JsxGeneratorResult> {
        for (const ns of namespaces) {
            for (const iface of ns.interfaces) {
                this.interfaceMap.set(iface.name, iface);
                this.interfaceMap.set(`${ns.name}.${iface.name}`, iface);
            }
        }

        this.usedNamespaces.clear();
        this.widgetNamespaceMap.clear();

        const allWidgets: WidgetInfo[] = [];
        for (const ns of namespaces) {
            const widgets = this.findWidgets(ns);
            for (const widget of widgets) {
                allWidgets.push({ widget, namespace: ns.name });
                this.widgetNamespaceMap.set(widget.name, ns.name);
                this.widgetNamespaceMap.set(`${ns.name}.${widget.name}`, ns.name);
            }
        }

        const containerMetadata = this.buildContainerMetadata(allWidgets);
        const widgetClass = this.classMap.get("Widget") ?? this.classMap.get("Gtk.Widget");

        this.widgetPropertyNames = new Set(widgetClass?.properties.map((p) => toCamelCase(p.name)) ?? []);
        this.widgetSignalNames = new Set(widgetClass?.signals.map((s) => toCamelCase(s.name)) ?? []);

        const commonTypes = this.generateCommonTypes(widgetClass);
        const widgetPropsInterfaces = this.generateWidgetPropsInterfaces(allWidgets, containerMetadata);
        const exports = this.generateExports(allWidgets, containerMetadata);
        const jsxNamespace = this.generateJsxNamespace(allWidgets, containerMetadata);

        const imports = this.generateImports();

        const jsxSections = [imports, commonTypes, widgetPropsInterfaces, exports, jsxNamespace, "export {};"];

        const internalSections = [
            this.generateInternalImports(),
            this.generateConstructorArgsMetadata(allWidgets),
            this.generatePropSettersMap(allWidgets),
            this.generateSetterGetterMap(allWidgets),
        ];

        return {
            jsx: await this.formatCode(jsxSections.join("\n")),
            internal: await this.formatCode(internalSections.join("\n")),
        };
    }

    private generateImports(): string {
        this.usedNamespaces.add("Gtk");

        const namespaceImports = [...this.usedNamespaces]
            .sort()
            .map((ns) => `import type * as ${ns} from "@gtkx/ffi/${ns.toLowerCase()}";`);

        return [
            `import "react";`,
            `import { createElement } from "react";`,
            `import type { ReactNode, Ref } from "react";`,
            ...namespaceImports,
            `import type { ColumnViewColumnProps, ColumnViewRootProps, GridChildProps, ListItemProps, ListViewRenderProps, MenuItemProps, MenuRootProps, MenuSectionProps, MenuSubmenuProps, NotebookPageProps, SlotProps, StackPageProps, StackRootProps } from "../types.js";`,
            "",
        ].join("\n");
    }

    private generateInternalImports(): string {
        return "/** Internal metadata for the reconciler. Not part of the public API. */\n";
    }

    private generateCommonTypes(widgetClass: GirClass | undefined): string {
        this.currentNamespace = "Gtk";
        this.typeMapper.setTypeRegistry(this.typeRegistry, "Gtk");
        const widgetPropsContent = this.generateWidgetPropsContent(widgetClass);

        return `
export { ColumnViewColumnProps, ColumnViewRootProps, GridChildProps, ListItemProps, ListViewRenderProps, MenuItemProps, MenuRootProps, MenuSectionProps, MenuSubmenuProps, NotebookPageProps, SlotProps, StackPageProps, StackRootProps };

${widgetPropsContent}
`;
    }

    private generateWidgetPropsContent(widgetClass: GirClass | undefined): string {
        const lines: string[] = [];
        const widgetDoc = widgetClass?.doc ? formatDoc(widgetClass.doc) : "";

        if (widgetDoc) {
            lines.push(widgetDoc.trimEnd());
        }
        lines.push("export interface WidgetProps {");

        if (widgetClass) {
            for (const prop of widgetClass.properties) {
                const propName = toCamelCase(prop.name);
                const tsType = this.toJsxPropertyType(this.typeMapper.mapType(prop.type).ts, "Gtk");

                if (prop.doc) {
                    lines.push(formatDoc(prop.doc, "\t").trimEnd());
                }
                lines.push(`\t${propName}?: ${tsType};`);
            }

            if (widgetClass.signals.length > 0) {
                lines.push("");
                for (const signal of widgetClass.signals) {
                    if (signal.doc) {
                        lines.push(formatDoc(signal.doc, "\t").trimEnd());
                    }
                    lines.push(`\t${this.generateSignalHandler(signal, "Widget")}`);
                }
            }
        }

        lines.push("");
        lines.push("\tchildren?: ReactNode;");
        lines.push("}");

        return lines.join("\n");
    }

    private buildContainerMetadata(widgets: WidgetInfo[]): Map<string, ContainerMetadata> {
        const metadata = new Map<string, ContainerMetadata>();
        for (const { widget, namespace } of widgets) {
            const key = `${namespace}.${widget.name}`;
            metadata.set(key, this.analyzeContainerCapabilities(widget));
        }
        return metadata;
    }

    private findWidgets(namespace: GirNamespace): GirClass[] {
        const widgetCache = new Map<string, boolean>();

        const checkIsWidget = (className: string, ns: string): boolean => {
            const cacheKey = `${ns}.${className}`;
            const cached = widgetCache.get(cacheKey);
            if (cached !== undefined) return cached;

            widgetCache.set(cacheKey, false);

            const cls = this.classMap.get(cacheKey) ?? this.classMap.get(className);
            if (!cls) return false;

            if (cls.name === "Widget") {
                widgetCache.set(cacheKey, true);
                return true;
            }

            if (cls.parent) {
                const parentNs = cls.parent.includes(".") ? cls.parent.split(".")[0] : ns;
                const parentName = cls.parent.includes(".") ? cls.parent.split(".")[1] : cls.parent;
                const result = checkIsWidget(parentName ?? "", parentNs ?? ns);
                widgetCache.set(cacheKey, result);
                return result;
            }

            return false;
        };

        const widgets = namespace.classes.filter((cls) => checkIsWidget(cls.name, namespace.name));

        return widgets.sort((a, b) => {
            if (a.name === "Widget") return -1;
            if (b.name === "Widget") return 1;
            if (a.name === "Window") return -1;
            if (b.name === "Window") return 1;
            return a.name.localeCompare(b.name);
        });
    }

    private analyzeContainerCapabilities(widget: GirClass): ContainerMetadata {
        const hasAppend = widget.methods.some((m) => m.name === "append");
        const hasSetChild = widget.methods.some((m) => m.name === "set_child");

        const namedChildSlots: WidgetChildInfo[] = widget.properties
            .filter((prop) => {
                if (!prop.writable) return false;
                if (WIDGET_REFERENCE_PROPERTIES.has(prop.name)) return false;
                const typeName = prop.type.name;
                return typeName === "Gtk.Widget" || typeName === "Widget" || isWidgetSubclass(typeName, this.classMap);
            })
            .map((prop) => ({
                propertyName: prop.name,
                slotName: toPascalCase(prop.name),
            }));

        if (isToolbarViewWidget(widget.name)) {
            namedChildSlots.push({ propertyName: "top", slotName: "Top" });
            namedChildSlots.push({ propertyName: "bottom", slotName: "Bottom" });
        }

        return {
            supportsMultipleChildren: hasAppend,
            supportsSingleChild: hasSetChild,
            namedChildSlots,
        };
    }

    private generateWidgetPropsInterfaces(
        widgets: WidgetInfo[],
        containerMetadata: Map<string, ContainerMetadata>,
    ): string {
        const sections: string[] = [];

        for (const { widget, namespace } of widgets) {
            if (widget.name === "Widget") continue;

            const metadataKey = `${namespace}.${widget.name}`;
            const metadata = containerMetadata.get(metadataKey);
            if (!metadata) throw new Error(`Missing container metadata for widget: ${metadataKey}`);

            this.currentNamespace = namespace;
            this.usedNamespaces.add(namespace);
            this.typeMapper.setTypeRegistry(this.typeRegistry, namespace);
            sections.push(this.generateWidgetProps(widget, metadata));
        }

        return sections.join("\n");
    }

    private getWidgetExportName(widget: GirClass): string {
        const baseName = toPascalCase(widget.name);
        if (this.currentNamespace === "Gtk") return baseName;
        return `${this.currentNamespace}${baseName}`;
    }

    private generateWidgetProps(widget: GirClass, metadata: ContainerMetadata): string {
        const widgetName = this.getWidgetExportName(widget);
        const parentPropsName = this.getParentPropsName(widget);
        const namedChildPropNames = new Set(metadata.namedChildSlots.map((s) => toCamelCase(s.propertyName)));

        const lines: string[] = [];
        lines.push(`/** Props for the {@link ${widgetName}} widget. */`);
        lines.push(`export interface ${widgetName}Props extends ${parentPropsName} {`);

        const requiredCtorParams = this.getRequiredConstructorParams(widget);

        const seenProps = new Set<string>();
        const allProps = [...widget.properties];
        for (const prop of widget.properties) {
            seenProps.add(prop.name);
        }
        const seenSignals = new Set<string>();
        const allSignals = [...widget.signals];
        for (const signal of widget.signals) {
            seenSignals.add(signal.name);
        }
        const parentInterfaces = this.getAncestorInterfaces(widget);
        for (const ifaceName of widget.implements) {
            if (parentInterfaces.has(ifaceName)) continue;
            const iface = this.interfaceMap.get(ifaceName);
            if (iface) {
                for (const prop of iface.properties) {
                    if (!seenProps.has(prop.name)) {
                        seenProps.add(prop.name);
                        allProps.push(prop);
                    }
                }
                for (const signal of iface.signals) {
                    if (!seenSignals.has(signal.name)) {
                        seenSignals.add(signal.name);
                        allSignals.push(signal);
                    }
                }
            }
        }

        const specificProps = allProps.filter((prop) => {
            const propName = toCamelCase(prop.name);
            return !this.widgetPropertyNames.has(propName) && !namedChildPropNames.has(propName);
        });

        const emittedProps = new Set<string>();
        for (const prop of specificProps) {
            const propName = toCamelCase(prop.name);
            emittedProps.add(prop.name);
            const typeMapping = this.typeMapper.mapType(prop.type);
            const tsType = this.toJsxPropertyType(typeMapping.ts, this.currentNamespace);
            const isRequiredByConstructor = requiredCtorParams.has(prop.name);
            const isRequired = isRequiredByConstructor;
            if (prop.doc) {
                lines.push(formatDoc(prop.doc, "\t").trimEnd());
            }
            lines.push(`\t${propName}${isRequired ? "" : "?"}: ${tsType};`);
        }

        for (const paramName of requiredCtorParams) {
            if (emittedProps.has(paramName)) continue;
            const propName = toCamelCase(paramName);
            const inheritedProp = this.findInheritedProperty(widget, paramName);
            if (inheritedProp) {
                const typeMapping = this.typeMapper.mapType(inheritedProp.type);
                const tsType = this.toJsxPropertyType(typeMapping.ts, this.currentNamespace);
                lines.push(`\t${propName}: ${tsType};`);
            }
        }

        const specificSignals = allSignals.filter((signal) => {
            const signalName = toCamelCase(signal.name);
            return !this.widgetSignalNames.has(signalName);
        });

        if (specificSignals.length > 0) {
            lines.push("");
            for (const signal of specificSignals) {
                if (signal.doc) {
                    lines.push(formatDoc(signal.doc, "\t").trimEnd());
                }
                lines.push(`\t${this.generateSignalHandler(signal, widget.name)}`);
            }
        }

        if (isListWidget(widget.name)) {
            lines.push("");
            lines.push(`\t/**`);
            lines.push(`\t * Render function for list items.`);
            lines.push(`\t * Called with null during setup (for loading state) and with the actual item during bind.`);
            lines.push(`\t */`);
            lines.push(`\trenderItem: (item: unknown) => import("react").ReactElement;`);
        }

        if (isDropDownWidget(widget.name)) {
            lines.push("");
            lines.push(`\t/** Function to convert item to display label */`);
            lines.push(`\titemLabel?: (item: unknown) => string;`);
            lines.push(`\t/** Called when selection changes */`);
            lines.push(`\tonSelectionChanged?: (item: unknown, index: number) => void;`);
        }

        lines.push("");
        const ffiTypeName = toPascalCase(widget.name);
        lines.push(`\tref?: Ref<${this.currentNamespace}.${ffiTypeName}>;`);
        lines.push(`}`);

        return `${lines.join("\n")}\n`;
    }

    private getParentPropsName(widget: GirClass): string {
        if (widget.name === "Window") return "WidgetProps";
        if (widget.name === "ApplicationWindow") return "WindowProps";

        if (!widget.parent) return "WidgetProps";

        const parentNs = widget.parent.includes(".") ? widget.parent.split(".")[0] : this.currentNamespace;
        const parentName = widget.parent.includes(".") ? widget.parent.split(".")[1] : widget.parent;

        if (parentName === "Widget") return "WidgetProps";
        if (parentName === "Window") return "WindowProps";

        const baseName = toPascalCase(parentName ?? "");
        if (parentNs === "Gtk") {
            return `${baseName}Props`;
        }

        return `${parentNs}${baseName}Props`;
    }

    private getRequiredConstructorParams(widget: GirClass): Set<string> {
        const required = new Set<string>();
        const mainCtor = widget.constructors.find((c) => c.name === "new");
        if (!mainCtor) return required;

        const internallyProvided = INTERNALLY_PROVIDED_PARAMS[widget.name] ?? new Set();
        for (const param of mainCtor.parameters) {
            if (!param.nullable && !param.optional) {
                const normalizedName = param.name.replace(/_/g, "-");
                if (!internallyProvided.has(normalizedName)) {
                    required.add(normalizedName);
                }
            }
        }
        return required;
    }

    private getConstructorParams(widget: GirClass): { name: string; hasDefault: boolean }[] {
        const mainCtor = widget.constructors.find((c) => c.name === "new");
        if (!mainCtor) return [];

        const params = mainCtor.parameters.map((param) => ({
            name: toCamelCase(param.name),
            hasDefault: param.nullable || param.optional || false,
        }));

        const required = params.filter((p) => !p.hasDefault);
        const optional = params.filter((p) => p.hasDefault);
        return [...required, ...optional];
    }

    private generateConstructorArgsMetadata(widgets: WidgetInfo[]): string {
        const entries: string[] = [];

        for (const { widget, namespace } of widgets) {
            const params = this.getConstructorParams(widget);
            if (params.length === 0) continue;

            this.currentNamespace = namespace;
            const widgetName = this.getWidgetExportName(widget);
            const paramStrs = params.map((p) => `{ name: "${p.name}", hasDefault: ${p.hasDefault} }`);
            entries.push(`\t${widgetName}: [${paramStrs.join(", ")}]`);
        }

        if (entries.length === 0) {
            return `export const CONSTRUCTOR_PARAMS: Record<string, { name: string; hasDefault: boolean }[]> = {};\n`;
        }

        return `export const CONSTRUCTOR_PARAMS: Record<string, { name: string; hasDefault: boolean }[]> = {\n${entries.join(",\n")},\n};\n`;
    }

    private generatePropSettersMap(widgets: WidgetInfo[]): string {
        const widgetEntries: string[] = [];

        for (const { widget, namespace } of widgets) {
            this.currentNamespace = namespace;
            const propSetterPairs: string[] = [];
            const allProps = this.collectAllProperties(widget);

            for (const prop of allProps) {
                if (prop.setter) {
                    const propName = toCamelCase(prop.name);
                    const setterName = toCamelCase(prop.setter);
                    propSetterPairs.push(`"${propName}": "${setterName}"`);
                }
            }

            if (propSetterPairs.length > 0) {
                const widgetName = this.getWidgetExportName(widget);
                widgetEntries.push(`\t${widgetName}: { ${propSetterPairs.join(", ")} }`);
            }
        }

        if (widgetEntries.length === 0) {
            return `export const PROP_SETTERS: Record<string, Record<string, string>> = {};\n`;
        }

        return `export const PROP_SETTERS: Record<string, Record<string, string>> = {\n${widgetEntries.join(",\n")},\n};\n`;
    }

    private generateSetterGetterMap(widgets: WidgetInfo[]): string {
        const widgetEntries: string[] = [];

        for (const { widget, namespace } of widgets) {
            this.currentNamespace = namespace;
            const setterGetterPairs: string[] = [];
            const allProps = this.collectAllProperties(widget);
            const parentMethodNames = this.collectParentMethodNames(widget);
            const widgetClassName = toPascalCase(widget.name);

            for (const prop of allProps) {
                if (prop.setter && prop.getter) {
                    const setterName = toCamelCase(prop.setter);
                    let getterName = toCamelCase(prop.getter);

                    if (parentMethodNames.has(prop.getter)) {
                        getterName = `${getterName}${widgetClassName}`;
                    }

                    setterGetterPairs.push(`"${setterName}": "${getterName}"`);
                }
            }

            if (setterGetterPairs.length > 0) {
                const widgetName = this.getWidgetExportName(widget);
                widgetEntries.push(`\t${widgetName}: { ${setterGetterPairs.join(", ")} }`);
            }
        }

        if (widgetEntries.length === 0) {
            return `export const SETTER_GETTERS: Record<string, Record<string, string>> = {};\n`;
        }

        return `export const SETTER_GETTERS: Record<string, Record<string, string>> = {\n${widgetEntries.join(",\n")},\n};\n`;
    }

    private collectParentMethodNames(widget: GirClass): Set<string> {
        const names = new Set<string>();
        const visited = new Set<string>();

        let parentRef = widget.parent;
        while (parentRef && !visited.has(parentRef)) {
            visited.add(parentRef);

            const current =
                this.classMap.get(parentRef) ??
                this.classMap.get(`${this.currentNamespace}.${parentRef}`) ??
                this.classMap.get(`Gtk.${parentRef}`);

            if (!current) break;

            for (const method of current.methods) {
                names.add(method.name);
            }

            for (const ifaceName of current.implements) {
                const iface = this.interfaceMap.get(ifaceName);
                if (iface) {
                    for (const method of iface.methods) {
                        names.add(method.name);
                    }
                }
            }

            parentRef = current.parent;
        }

        return names;
    }

    private collectAllProperties(widget: GirClass): { name: string; setter?: string; getter?: string }[] {
        const props: { name: string; setter?: string; getter?: string }[] = [];
        const seen = new Set<string>();

        let current: GirClass | undefined = widget;
        while (current) {
            for (const prop of current.properties) {
                if (!seen.has(prop.name)) {
                    seen.add(prop.name);
                    props.push({ name: prop.name, setter: prop.setter, getter: prop.getter });
                }
            }

            for (const ifaceName of current.implements) {
                const iface = this.interfaceMap.get(ifaceName);
                if (iface) {
                    for (const prop of iface.properties) {
                        if (!seen.has(prop.name)) {
                            seen.add(prop.name);
                            props.push({ name: prop.name, setter: prop.setter, getter: prop.getter });
                        }
                    }
                }
            }

            if (current.parent) {
                current =
                    this.classMap.get(current.parent) ??
                    this.classMap.get(`${this.currentNamespace}.${current.parent}`) ??
                    this.classMap.get(`Gtk.${current.parent}`);
            } else {
                current = undefined;
            }
        }

        return props;
    }

    private getAncestorInterfaces(widget: GirClass): Set<string> {
        const interfaces = new Set<string>();
        let current = widget.parent ? this.classMap.get(widget.parent) : undefined;
        while (current) {
            for (const ifaceName of current.implements) {
                interfaces.add(ifaceName);
            }
            current = current.parent ? this.classMap.get(current.parent) : undefined;
        }
        return interfaces;
    }

    private findInheritedProperty(widget: GirClass, propName: string): { type: { name: string } } | undefined {
        let current: GirClass | undefined = widget.parent ? this.classMap.get(widget.parent) : undefined;
        while (current) {
            const prop = current.properties.find((p) => p.name === propName);
            if (prop) return prop;
            for (const ifaceName of current.implements) {
                const iface = this.interfaceMap.get(ifaceName);
                if (iface) {
                    const ifaceProp = iface.properties.find((p) => p.name === propName);
                    if (ifaceProp) return ifaceProp;
                }
            }
            current = current.parent ? this.classMap.get(current.parent) : undefined;
        }
        for (const ifaceName of widget.implements) {
            const iface = this.interfaceMap.get(ifaceName);
            if (iface) {
                const ifaceProp = iface.properties.find((p) => p.name === propName);
                if (ifaceProp) return ifaceProp;
            }
        }
        return undefined;
    }

    private generateSignalHandler(signal: GirSignal, widgetName: string): string {
        const signalName = toCamelCase(signal.name);
        const handlerName = `on${signalName.charAt(0).toUpperCase()}${signalName.slice(1)}`;
        const handlerType = this.buildSignalHandlerType(signal, widgetName);
        return `${handlerName}?: ${handlerType};`;
    }

    private getSignalParamFfiType(typeName: string | undefined): string | undefined {
        if (!typeName) return undefined;

        if (typeName.includes(".")) {
            const [ns, className] = typeName.split(".", 2);
            if (ns && className) {
                const registered = this.typeRegistry.resolve(`${ns}.${className}`);
                if (registered && (registered.kind === "class" || registered.kind === "interface")) {
                    this.usedNamespaces.add(ns);
                    return `${ns}.${registered.transformedName}`;
                }
            }
            return undefined;
        }

        const registered = this.typeRegistry.resolveInNamespace(typeName, this.currentNamespace);
        if (registered && (registered.kind === "class" || registered.kind === "interface")) {
            this.usedNamespaces.add(registered.namespace);
            if (registered.namespace === this.currentNamespace) {
                return `${this.currentNamespace}.${registered.transformedName}`;
            }
            return `${registered.namespace}.${registered.transformedName}`;
        }

        return undefined;
    }

    private addNamespacePrefix(tsType: string): string {
        const primitives = new Set(["boolean", "number", "string", "void", "unknown", "null", "undefined"]);
        if (primitives.has(tsType)) return tsType;

        if (tsType.endsWith("[]")) {
            const elementType = tsType.slice(0, -2);
            if (primitives.has(elementType)) return tsType;
            if (elementType.includes(".") || elementType.includes("<") || elementType.includes("(")) return tsType;
            return `${this.currentNamespace}.${elementType}[]`;
        }

        if (tsType.includes(".") || tsType.includes("<") || tsType.includes("(")) return tsType;
        return `${this.currentNamespace}.${tsType}`;
    }

    private toJsxPropertyType(tsType: string, namespace: string): string {
        const result = toJsxPropertyTypeBase(tsType, namespace);

        if (result.includes(".") && !result.includes("<") && !result.includes("(")) {
            const ns = result.split(".")[0];
            if (ns) {
                this.usedNamespaces.add(ns);
            }
        }

        return result;
    }

    private buildSignalHandlerType(signal: GirSignal, widgetName: string): string {
        const selfParam = `self: ${this.currentNamespace}.${toPascalCase(widgetName)}`;
        const otherParams =
            signal.parameters
                ?.map((p) => {
                    const ffiType = this.getSignalParamFfiType(p.type.name);
                    if (ffiType) {
                        return `${toCamelCase(p.name)}: ${ffiType}`;
                    }

                    const paramMapping = this.typeMapper.mapParameter(p);
                    const tsType = this.addNamespacePrefix(paramMapping.ts);

                    return `${toCamelCase(p.name)}: ${tsType}`;
                })
                .join(", ") ?? "";

        const returnType = signal.returnType
            ? this.addNamespacePrefix(this.typeMapper.mapType(signal.returnType).ts)
            : "void";

        const params = otherParams ? `${selfParam}, ${otherParams}` : selfParam;
        return `(${params}) => ${returnType}`;
    }

    private generateExports(widgets: WidgetInfo[], containerMetadata: Map<string, ContainerMetadata>): string {
        const lines: string[] = [];

        for (const { widget, namespace } of widgets) {
            this.currentNamespace = namespace;
            const widgetName = this.getWidgetExportName(widget);
            const metadataKey = `${namespace}.${widget.name}`;
            const metadata = containerMetadata.get(metadataKey);
            if (!metadata) throw new Error(`Missing container metadata for widget: ${metadataKey}`);

            const nonChildSlots = metadata.namedChildSlots.filter((slot) => slot.slotName !== "Child");
            const hasMeaningfulSlots =
                nonChildSlots.length > 0 ||
                isListWidget(widget.name) ||
                isColumnViewWidget(widget.name) ||
                isDropDownWidget(widget.name) ||
                isGridWidget(widget.name) ||
                isNotebookWidget(widget.name) ||
                isStackWidget(widget.name) ||
                isPopoverMenuWidget(widget.name);

            const docComment = widget.doc ? formatDoc(widget.doc).trimEnd() : "";

            if (hasMeaningfulSlots) {
                if (
                    isListWidget(widget.name) ||
                    isColumnViewWidget(widget.name) ||
                    isDropDownWidget(widget.name) ||
                    isStackWidget(widget.name) ||
                    isPopoverMenuWidget(widget.name)
                ) {
                    const wrapperComponents = this.generateGenericWrapperComponents(widgetName, metadata);
                    const exportMembers = this.getWrapperExportMembers(widgetName, metadata);

                    if (docComment) {
                        lines.push(
                            `${wrapperComponents}\n${docComment}\nexport const ${widgetName} = {\n\t${exportMembers.join(",\n\t")},\n};`,
                        );
                    } else {
                        lines.push(
                            `${wrapperComponents}\nexport const ${widgetName} = {\n\t${exportMembers.join(",\n\t")},\n};`,
                        );
                    }
                } else {
                    const valueMembers = [
                        `Root: "${widgetName}.Root" as const`,
                        ...metadata.namedChildSlots.map(
                            (slot) => `${slot.slotName}: "${widgetName}.${slot.slotName}" as const`,
                        ),
                        ...(isGridWidget(widget.name) ? [`Child: "${widgetName}.Child" as const`] : []),
                        ...(isNotebookWidget(widget.name) ? [`Page: "${widgetName}.Page" as const`] : []),
                    ];
                    if (docComment) {
                        lines.push(
                            `${docComment}\nexport const ${widgetName} = {\n\t${valueMembers.join(",\n\t")},\n};`,
                        );
                    } else {
                        lines.push(`export const ${widgetName} = {\n\t${valueMembers.join(",\n\t")},\n};`);
                    }
                }
            } else {
                if (docComment) {
                    lines.push(`${docComment}\nexport const ${widgetName} = "${widgetName}" as const;`);
                } else {
                    lines.push(`export const ${widgetName} = "${widgetName}" as const;`);
                }
            }
        }

        lines.push(this.generateApplicationMenuComponents());

        return `${lines.join("\n")}\n`;
    }

    private generateApplicationMenuComponents(): string {
        return `/**
 * Sets the application-wide menu bar.
 * The menu will appear in the window's title bar on supported platforms.
 * Use Menu.Item, Menu.Section, and Menu.Submenu as children.
 */
export const ApplicationMenu = "ApplicationMenu" as const;

function MenuItem(props: MenuItemProps): import("react").ReactElement {
\treturn createElement("Menu.Item", props);
}

function MenuSection(props: MenuSectionProps): import("react").ReactElement {
\treturn createElement("Menu.Section", props);
}

function MenuSubmenu(props: MenuSubmenuProps): import("react").ReactElement {
\treturn createElement("Menu.Submenu", props);
}

/**
 * Declarative menu builder for use with PopoverMenu and ApplicationMenu.
 * Use Menu.Item for action items, Menu.Section for groups, Menu.Submenu for nested menus.
 */
export const Menu = {
\tItem: MenuItem,
\tSection: MenuSection,
\tSubmenu: MenuSubmenu,
};
`;
    }

    private getWrapperExportMembers(widgetName: string, metadata: ContainerMetadata): string[] {
        const name = toPascalCase(widgetName);
        const members: string[] = [`Root: ${name}Root`];

        if (isListWidget(widgetName)) {
            members.push(`Item: ${name}Item`);
        } else if (isColumnViewWidget(widgetName)) {
            members.push(`Column: ${name}Column`);
            members.push(`Item: ${name}Item`);
        } else if (isDropDownWidget(widgetName)) {
            members.push(`Item: ${name}Item`);
        } else if (isStackWidget(widgetName)) {
            members.push(`Page: ${name}Page`);
        } else if (isPopoverMenuWidget(widgetName)) {
            members.push(`Item: ${name}Item`);
            members.push(`Section: ${name}Section`);
            members.push(`Submenu: ${name}Submenu`);
        }

        for (const slot of metadata.namedChildSlots) {
            members.push(`${slot.slotName}: ${name}${slot.slotName}`);
        }

        return members;
    }

    private generateGenericWrapperComponents(widgetName: string, metadata: ContainerMetadata): string {
        const name = toPascalCase(widgetName);
        const lines: string[] = [];

        if (isListWidget(widgetName)) {
            lines.push(`/**`);
            lines.push(` * Props for the ${name}.Root component with type-safe item rendering.`);
            lines.push(` * @typeParam T - The type of items in the list.`);
            lines.push(` */`);
            lines.push(`interface ${name}RootProps<T> extends Omit<${name}Props, "renderItem"> {`);
            lines.push(`\t/** Render function for list items. Called with null during setup (for loading state). */`);
            lines.push(`\trenderItem: (item: T | null) => import("react").ReactElement;`);
            lines.push(`}`);
            lines.push(``);
            lines.push(`function ${name}Root<T>(props: ${name}RootProps<T>): import("react").ReactElement {`);
            lines.push(`\treturn createElement("${name}.Root", props);`);
            lines.push(`}`);
            lines.push(``);
            lines.push(`function ${name}Item<T>(props: ListItemProps<T>): import("react").ReactElement {`);
            lines.push(`\treturn createElement("${name}.Item", props);`);
            lines.push(`}`);
        } else if (isColumnViewWidget(widgetName)) {
            lines.push(`/**`);
            lines.push(` * Props for the ${name}.Root component with type-safe item and column rendering.`);
            lines.push(` * @typeParam T - The type of items in the column view.`);
            lines.push(` * @typeParam C - The union type of column IDs for type-safe sorting.`);
            lines.push(` */`);
            lines.push(
                `interface ${name}RootPropsExtended<T = unknown, C extends string = string> extends ${name}Props, ColumnViewRootProps<T, C> {}`,
            );
            lines.push(``);
            lines.push(
                `function ${name}Root<T = unknown, C extends string = string>(props: ${name}RootPropsExtended<T, C>): import("react").ReactElement {`,
            );
            lines.push(`\treturn createElement("${name}.Root", props);`);
            lines.push(`}`);
            lines.push(``);
            lines.push(`/**`);
            lines.push(` * Props for ${name}.Column with type-safe cell rendering.`);
            lines.push(` * @typeParam T - The type of items passed to the renderCell function.`);
            lines.push(` */`);
            lines.push(`interface ${name}GenericColumnProps<T> extends Omit<ColumnViewColumnProps, "renderCell"> {`);
            lines.push(`\t/** Render function for column cells. Called with null during setup (for loading state). */`);
            lines.push(`\trenderCell: (item: T | null) => import("react").ReactElement;`);
            lines.push(`}`);
            lines.push(``);
            lines.push(
                `function ${name}Column<T>(props: ${name}GenericColumnProps<T>): import("react").ReactElement {`,
            );
            lines.push(`\treturn createElement("${name}.Column", props);`);
            lines.push(`}`);
            lines.push(``);
            lines.push(`function ${name}Item<T>(props: ListItemProps<T>): import("react").ReactElement {`);
            lines.push(`\treturn createElement("${name}.Item", props);`);
            lines.push(`}`);
        } else if (isDropDownWidget(widgetName)) {
            lines.push(`/**`);
            lines.push(` * Props for the ${name}.Root component with type-safe item handling.`);
            lines.push(` * @typeParam T - The type of items in the dropdown.`);
            lines.push(` */`);
            lines.push(
                `interface ${name}RootProps<T> extends Omit<${name}Props, "itemLabel" | "onSelectionChanged"> {`,
            );
            lines.push(`\t/** Function to convert an item to its display label. */`);
            lines.push(`\titemLabel?: (item: T) => string;`);
            lines.push(`\t/** Called when the selected item changes. */`);
            lines.push(`\tonSelectionChanged?: (item: T | null, index: number) => void;`);
            lines.push(`}`);
            lines.push(``);
            lines.push(`function ${name}Root<T>(props: ${name}RootProps<T>): import("react").ReactElement {`);
            lines.push(`\treturn createElement("${name}.Root", props);`);
            lines.push(`}`);
            lines.push(``);
            lines.push(`function ${name}Item<T>(props: ListItemProps<T>): import("react").ReactElement {`);
            lines.push(`\treturn createElement("${name}.Item", props);`);
            lines.push(`}`);
        } else if (isStackWidget(widgetName)) {
            lines.push(`function ${name}Root(props: StackRootProps & ${name}Props): import("react").ReactElement {`);
            lines.push(`\treturn createElement("${name}.Root", props);`);
            lines.push(`}`);
            lines.push(``);
            lines.push(`function ${name}Page(props: StackPageProps): import("react").ReactElement {`);
            lines.push(`\treturn createElement("${name}.Page", props);`);
            lines.push(`}`);
        } else if (isPopoverMenuWidget(widgetName)) {
            lines.push(`function ${name}Root(props: MenuRootProps & ${name}Props): import("react").ReactElement {`);
            lines.push(`\treturn createElement("${name}.Root", props);`);
            lines.push(`}`);
            lines.push(``);
            lines.push(`function ${name}Item(props: MenuItemProps): import("react").ReactElement {`);
            lines.push(`\treturn createElement("Menu.Item", props);`);
            lines.push(`}`);
            lines.push(``);
            lines.push(`function ${name}Section(props: MenuSectionProps): import("react").ReactElement {`);
            lines.push(`\treturn createElement("Menu.Section", props);`);
            lines.push(`}`);
            lines.push(``);
            lines.push(`function ${name}Submenu(props: MenuSubmenuProps): import("react").ReactElement {`);
            lines.push(`\treturn createElement("Menu.Submenu", props);`);
            lines.push(`}`);
        }

        for (const slot of metadata.namedChildSlots) {
            lines.push(``);
            lines.push(`function ${name}${slot.slotName}(props: SlotProps): import("react").ReactElement {`);
            lines.push(`\treturn createElement("${name}.${slot.slotName}", props);`);
            lines.push(`}`);
        }

        return lines.join("\n");
    }

    private generateJsxNamespace(widgets: WidgetInfo[], containerMetadata: Map<string, ContainerMetadata>): string {
        const elements: string[] = [];

        for (const { widget, namespace } of widgets) {
            if (widget.name === "Widget") continue;

            this.currentNamespace = namespace;
            const widgetName = this.getWidgetExportName(widget);
            const propsName = `${widgetName}Props`;
            const metadataKey = `${namespace}.${widget.name}`;
            const metadata = containerMetadata.get(metadataKey);
            if (!metadata) throw new Error(`Missing container metadata for widget: ${metadataKey}`);

            const nonChildSlots = metadata.namedChildSlots.filter((slot) => slot.slotName !== "Child");
            const hasMeaningfulSlots =
                nonChildSlots.length > 0 ||
                isListWidget(widget.name) ||
                isColumnViewWidget(widget.name) ||
                isDropDownWidget(widget.name) ||
                isGridWidget(widget.name) ||
                isNotebookWidget(widget.name) ||
                isStackWidget(widget.name) ||
                isPopoverMenuWidget(widget.name);

            if (hasMeaningfulSlots) {
                elements.push(`"${widgetName}.Root": ${propsName};`);
            } else {
                elements.push(`${widgetName}: ${propsName};`);
            }

            for (const slot of metadata.namedChildSlots) {
                elements.push(`"${widgetName}.${slot.slotName}": SlotProps;`);
            }

            if (isListWidget(widget.name)) {
                elements.push(`"${widgetName}.Item": ListItemProps;`);
            }

            if (isColumnViewWidget(widget.name)) {
                elements.push(`"${widgetName}.Column": ColumnViewColumnProps;`);
                elements.push(`"${widgetName}.Item": ListItemProps;`);
            }

            if (isDropDownWidget(widget.name)) {
                elements.push(`"${widgetName}.Item": ListItemProps;`);
            }

            if (isGridWidget(widget.name)) {
                elements.push(`"${widgetName}.Child": GridChildProps;`);
            }

            if (isNotebookWidget(widget.name)) {
                elements.push(`"${widgetName}.Page": NotebookPageProps;`);
            }

            if (isStackWidget(widget.name)) {
                elements.push(`"${widgetName}.Page": StackPageProps;`);
            }
        }

        this.addMenuIntrinsicElements(elements);
        elements.push(`ApplicationMenu: MenuRootProps;`);

        return `
declare global {
\tnamespace React {
\t\tnamespace JSX {
\t\t\tinterface IntrinsicElements {
\t\t\t\t${elements.join("\n\t\t\t\t")}
\t\t\t}
\t\t}
\t}
}
`;
    }

    private addMenuIntrinsicElements(elements: string[]): void {
        elements.push(`"Menu.Item": MenuItemProps;`);
        elements.push(`"Menu.Section": MenuSectionProps;`);
        elements.push(`"Menu.Submenu": MenuSubmenuProps;`);
    }

    private async formatCode(code: string): Promise<string> {
        try {
            return await format(code, {
                parser: "typescript",
                ...(this.options.prettierConfig &&
                typeof this.options.prettierConfig === "object" &&
                this.options.prettierConfig !== null
                    ? (this.options.prettierConfig as Record<string, unknown>)
                    : {}),
            });
        } catch (error) {
            console.warn("Failed to format code:", error);
            return code;
        }
    }
}
