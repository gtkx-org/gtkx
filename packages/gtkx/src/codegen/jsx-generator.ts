import type { GirClass, GirInterface, GirNamespace, GirSignal, TypeMapper } from "@gtkx/gir";
import { toCamelCase, toPascalCase } from "@gtkx/gir";
import { format } from "prettier";

/**
 * Configuration options for the JSX type generator.
 */
export interface JsxGeneratorOptions {
    /** Optional Prettier configuration for formatting output. */
    prettierConfig?: unknown;
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

const LIST_WIDGETS = new Set(["ListView", "ColumnView", "GridView"]);
const DROPDOWN_WIDGETS = new Set(["DropDown"]);
const GRID_WIDGETS = new Set(["Grid"]);

const INTERNALLY_PROVIDED_PARAMS: Record<string, Set<string>> = {
    ApplicationWindow: new Set(["application"]),
};

const isPrimitive = (tsType: string): boolean => {
    const primitives = new Set(["boolean", "number", "string", "void", "unknown", "null", "undefined"]);
    return primitives.has(tsType);
};

const toJsxPropertyType = (tsType: string): string => {
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

    return `Gtk.${result}`;
};

const isListWidget = (widgetName: string): boolean => LIST_WIDGETS.has(widgetName);
const isDropDownWidget = (widgetName: string): boolean => DROPDOWN_WIDGETS.has(widgetName);
const isGridWidget = (widgetName: string): boolean => GRID_WIDGETS.has(widgetName);

const sanitizeDoc = (doc: string): string => {
    let result = doc;
    result = result.replace(/<picture>[\s\S]*?<\/picture>/gi, "");
    result = result.replace(/<img[^>]*>/gi, "");
    result = result.replace(/<source[^>]*>/gi, "");
    result = result.replace(/!\[[^\]]*\]\([^)]+\.png\)/gi, "");
    result = result.replace(/<kbd>([^<]*)<\/kbd>/gi, "`$1`");
    result = result.replace(/<kbd>/gi, "`");
    result = result.replace(/<\/kbd>/gi, "`");
    result = result.replace(/\[([^\]]+)\]\([^)]+\.html[^)]*\)/gi, "$1");
    result = result.replace(/@(\w+)\s/g, "`$1` ");
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
    private classMap: Map<string, GirClass> = new Map();
    private interfaceMap: Map<string, GirInterface> = new Map();
    private namespace = "";
    private usedExternalNamespaces: Set<string> = new Set();
    private widgetPropertyNames: Set<string> = new Set();
    private widgetSignalNames: Set<string> = new Set();

    /**
     * Creates a new JSX generator.
     * @param typeMapper - TypeMapper for converting GIR types to TypeScript
     * @param options - Generator configuration options
     */
    constructor(
        private typeMapper: TypeMapper,
        private options: JsxGeneratorOptions = {},
    ) {}

    /**
     * Generates JSX type definitions for all widgets in a namespace.
     * @param namespace - The parsed GIR namespace
     * @param classMap - Map of class names to class definitions
     * @returns Generated TypeScript code as a string
     */
    async generate(namespace: GirNamespace, classMap: Map<string, GirClass>): Promise<string> {
        this.classMap = classMap;
        this.interfaceMap = new Map(namespace.interfaces.map((iface) => [iface.name, iface]));
        this.namespace = namespace.name;
        this.usedExternalNamespaces.clear();

        const widgets = this.findWidgets(namespace, classMap);
        const containerMetadata = this.buildContainerMetadata(widgets, classMap);
        const widgetClass = classMap.get("Widget");

        this.widgetPropertyNames = new Set(widgetClass?.properties.map((p) => toCamelCase(p.name)) ?? []);
        this.widgetSignalNames = new Set(widgetClass?.signals.map((s) => toCamelCase(s.name)) ?? []);

        const widgetPropsInterfaces = this.generateWidgetPropsInterfaces(widgets, containerMetadata);

        const sections = [
            this.generateImports(),
            this.generateCommonTypes(widgetClass),
            widgetPropsInterfaces,
            this.generateConstructorArgsMetadata(widgets),
            this.generateExports(widgets, containerMetadata),
            this.generateJsxNamespace(widgets, containerMetadata),
            "export {};",
        ];

        return this.formatCode(sections.join("\n"));
    }

    private generateImports(): string {
        const externalImports = [...this.usedExternalNamespaces]
            .sort()
            .map((ns) => `import type * as ${ns} from "@gtkx/ffi/${ns.toLowerCase()}";`);

        return [
            `import type { ReactNode, Ref } from "react";`,
            ...externalImports,
            `import type * as Gtk from "@gtkx/ffi/gtk";`,
            `import type { GridChildProps, ItemProps, SlotProps } from "../types.js";`,
            "",
        ].join("\n");
    }

    private generateCommonTypes(widgetClass: GirClass | undefined): string {
        const widgetPropsContent = this.generateWidgetPropsContent(widgetClass);

        return `
export { SlotProps, GridChildProps, ItemProps };

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
                const tsType = toJsxPropertyType(this.typeMapper.mapType(prop.type).ts);

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
                    lines.push(`\t${this.generateSignalHandler(signal)}`);
                }
            }
        }

        lines.push("");
        lines.push("\tchildren?: ReactNode;");
        lines.push("}");

        return lines.join("\n");
    }

    private buildContainerMetadata(
        widgets: GirClass[],
        classMap: Map<string, GirClass>,
    ): Map<string, ContainerMetadata> {
        const metadata = new Map<string, ContainerMetadata>();
        for (const widget of widgets) {
            metadata.set(widget.name, this.analyzeContainerCapabilities(widget, classMap));
        }
        return metadata;
    }

    private findWidgets(namespace: GirNamespace, classMap: Map<string, GirClass>): GirClass[] {
        const widgetCache = new Map<string, boolean>();

        const checkIsWidget = (className: string): boolean => {
            const cached = widgetCache.get(className);
            if (cached !== undefined) return cached;

            const cls = classMap.get(className);
            if (!cls) {
                widgetCache.set(className, false);
                return false;
            }

            if (cls.name === "Widget") {
                widgetCache.set(className, true);
                return true;
            }

            const result = cls.parent ? checkIsWidget(cls.parent) : false;
            widgetCache.set(className, result);
            return result;
        };

        const widgets = namespace.classes.filter((cls) => checkIsWidget(cls.name));

        return widgets.sort((a, b) => {
            if (a.name === "Widget") return -1;
            if (b.name === "Widget") return 1;
            if (a.name === "Window") return -1;
            if (b.name === "Window") return 1;
            return a.name.localeCompare(b.name);
        });
    }

    private analyzeContainerCapabilities(widget: GirClass, classMap: Map<string, GirClass>): ContainerMetadata {
        const hasAppend = widget.methods.some((m) => m.name === "append");
        const hasSetChild = widget.methods.some((m) => m.name === "set_child");

        const namedChildSlots: WidgetChildInfo[] = widget.properties
            .filter((prop) => {
                if (!prop.writable) return false;
                const typeName = prop.type.name;
                return typeName === "Gtk.Widget" || typeName === "Widget" || isWidgetSubclass(typeName, classMap);
            })
            .map((prop) => ({
                propertyName: prop.name,
                slotName: toPascalCase(prop.name),
            }));

        return {
            supportsMultipleChildren: hasAppend,
            supportsSingleChild: hasSetChild,
            namedChildSlots,
        };
    }

    private generateWidgetPropsInterfaces(
        widgets: GirClass[],
        containerMetadata: Map<string, ContainerMetadata>,
    ): string {
        const sections: string[] = [];

        for (const widget of widgets) {
            if (widget.name === "Widget") continue;

            const metadata = containerMetadata.get(widget.name);
            if (!metadata) throw new Error(`Missing container metadata for widget: ${widget.name}`);

            sections.push(this.generateWidgetProps(widget, metadata));
        }

        return sections.join("\n");
    }

    private generateWidgetProps(widget: GirClass, metadata: ContainerMetadata): string {
        const widgetName = toPascalCase(widget.name);
        const parentPropsName = this.getParentPropsName(widget);
        const namedChildPropNames = new Set(metadata.namedChildSlots.map((s) => toCamelCase(s.propertyName)));

        const lines: string[] = [];
        if (widget.doc) {
            lines.push(formatDoc(widget.doc).trimEnd());
        }
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
            const tsType = toJsxPropertyType(typeMapping.ts);
            const isRequiredByProperty = prop.constructOnly && !prop.hasDefault;
            const isRequiredByConstructor = requiredCtorParams.has(prop.name);
            const isRequired = isRequiredByProperty || isRequiredByConstructor;
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
                const tsType = toJsxPropertyType(typeMapping.ts);
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
                lines.push(`\t${this.generateSignalHandler(signal)}`);
            }
        }

        if (isListWidget(widget.name)) {
            lines.push("");
            lines.push(`\t/** Function to render each item as a GTK widget */`);
            lines.push(`\trenderItem?: (item: any) => Gtk.Widget;`);
        }

        if (isDropDownWidget(widget.name)) {
            lines.push("");
            lines.push(`\t/** Function to convert item to display label */`);
            lines.push(`\titemLabel?: (item: any) => string;`);
            lines.push(`\t/** Called when selection changes */`);
            lines.push(`\tonSelectionChanged?: (item: any, index: number) => void;`);
        }

        lines.push("");
        lines.push(`\tref?: Ref<Gtk.${widgetName}>;`);
        lines.push(`}`);

        return `${lines.join("\n")}\n`;
    }

    private getParentPropsName(widget: GirClass): string {
        if (widget.name === "Window") return "WidgetProps";
        if (widget.name === "ApplicationWindow") return "WindowProps";
        if (widget.parent === "Widget") return "WidgetProps";
        if (widget.parent === "Window") return "WindowProps";
        return widget.parent ? `${toPascalCase(widget.parent)}Props` : "WidgetProps";
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

        return mainCtor.parameters.map((param) => ({
            name: toCamelCase(param.name),
            hasDefault: param.nullable || param.optional || false,
        }));
    }

    private generateConstructorArgsMetadata(widgets: GirClass[]): string {
        const entries: string[] = [];

        for (const widget of widgets) {
            const params = this.getConstructorParams(widget);
            if (params.length === 0) continue;

            const widgetName = toPascalCase(widget.name);
            const paramStrs = params.map((p) => `{ name: "${p.name}", hasDefault: ${p.hasDefault} }`);
            entries.push(`\t${widgetName}: [${paramStrs.join(", ")}]`);
        }

        if (entries.length === 0) {
            return `export const CONSTRUCTOR_PARAMS: Record<string, { name: string; hasDefault: boolean }[]> = {};\n`;
        }

        return `export const CONSTRUCTOR_PARAMS: Record<string, { name: string; hasDefault: boolean }[]> = {\n${entries.join(",\n")},\n};\n`;
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

    private generateSignalHandler(signal: GirSignal): string {
        const signalName = toCamelCase(signal.name);
        const handlerName = `on${signalName.charAt(0).toUpperCase()}${signalName.slice(1)}`;
        const handlerType = this.buildSignalHandlerType(signal);
        return `${handlerName}?: ${handlerType};`;
    }

    private getSignalParamFfiType(typeName: string | undefined): string | undefined {
        if (!typeName) return undefined;

        if (typeName.includes(".")) {
            const [ns, className] = typeName.split(".", 2);
            if (ns === this.namespace && className && this.classMap.has(className)) {
                return `Gtk.${toPascalCase(className)}`;
            }
            if (ns) {
                this.usedExternalNamespaces.add(ns);
                return typeName;
            }
            return undefined;
        }

        const normalizedName = toPascalCase(typeName);
        if (this.classMap.has(typeName) || this.classMap.has(normalizedName)) {
            return `Gtk.${normalizedName}`;
        }

        return undefined;
    }

    private addNamespacePrefix(tsType: string): string {
        const primitives = new Set(["boolean", "number", "string", "void", "unknown", "null", "undefined"]);
        if (primitives.has(tsType)) return tsType;
        if (tsType.includes(".") || tsType.includes("<") || tsType.includes("(")) return tsType;
        return `Gtk.${tsType}`;
    }

    private buildSignalHandlerType(signal: GirSignal): string {
        const params =
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

        return params ? `(${params}) => ${returnType}` : `() => ${returnType}`;
    }

    private generateExports(widgets: GirClass[], containerMetadata: Map<string, ContainerMetadata>): string {
        const lines: string[] = [];

        for (const widget of widgets) {
            const widgetName = toPascalCase(widget.name);
            const metadata = containerMetadata.get(widget.name);
            if (!metadata) throw new Error(`Missing container metadata for widget: ${widget.name}`);

            const nonChildSlots = metadata.namedChildSlots.filter((slot) => slot.slotName !== "Child");
            const hasMeaningfulSlots =
                nonChildSlots.length > 0 ||
                isListWidget(widget.name) ||
                isDropDownWidget(widget.name) ||
                isGridWidget(widget.name);

            if (hasMeaningfulSlots) {
                const valueMembers = [
                    `Root: "${widgetName}.Root" as const`,
                    ...metadata.namedChildSlots.map(
                        (slot) => `${slot.slotName}: "${widgetName}.${slot.slotName}" as const`,
                    ),
                    ...(isListWidget(widget.name) ? [`Item: "${widgetName}.Item" as const`] : []),
                    ...(isDropDownWidget(widget.name) ? [`Item: "${widgetName}.Item" as const`] : []),
                    ...(isGridWidget(widget.name) ? [`Child: "${widgetName}.Child" as const`] : []),
                ];
                lines.push(`export const ${widgetName} = {\n\t${valueMembers.join(",\n\t")},\n};`);
            } else {
                lines.push(`export const ${widgetName} = "${widgetName}" as const;`);
            }
        }

        return `${lines.join("\n")}\n`;
    }

    private generateJsxNamespace(widgets: GirClass[], containerMetadata: Map<string, ContainerMetadata>): string {
        const elements: string[] = [];

        for (const widget of widgets) {
            if (widget.name === "Widget") continue;

            const widgetName = toPascalCase(widget.name);
            const propsName = `${widgetName}Props`;
            const metadata = containerMetadata.get(widget.name);
            if (!metadata) throw new Error(`Missing container metadata for widget: ${widget.name}`);

            const nonChildSlots = metadata.namedChildSlots.filter((slot) => slot.slotName !== "Child");
            const hasMeaningfulSlots =
                nonChildSlots.length > 0 ||
                isListWidget(widget.name) ||
                isDropDownWidget(widget.name) ||
                isGridWidget(widget.name);

            if (hasMeaningfulSlots) {
                elements.push(`"${widgetName}.Root": ${propsName};`);
            } else {
                elements.push(`${widgetName}: ${propsName};`);
            }

            for (const slot of metadata.namedChildSlots) {
                elements.push(`"${widgetName}.${slot.slotName}": SlotProps;`);
            }

            if (isListWidget(widget.name)) {
                elements.push(`"${widgetName}.Item": ItemProps<any>;`);
            }

            if (isDropDownWidget(widget.name)) {
                elements.push(`"${widgetName}.Item": ItemProps<any>;`);
            }

            if (isGridWidget(widget.name)) {
                elements.push(`"${widgetName}.Child": GridChildProps;`);
            }
        }

        return `
declare module "react" {
\tnamespace JSX {
\t\tinterface IntrinsicElements {
\t\t\t${elements.join("\n\t\t\t")}
\t\t}
\t}
}
`;
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
