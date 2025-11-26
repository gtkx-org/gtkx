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

const COMMON_WIDGET_PROPS = new Set([
    "halign",
    "valign",
    "hexpand",
    "vexpand",
    "marginStart",
    "marginEnd",
    "marginTop",
    "marginBottom",
    "widthRequest",
    "heightRequest",
    "visible",
    "sensitive",
    "canFocus",
    "canTarget",
    "focusOnClick",
    "opacity",
    "cssClasses",
    "tooltipText",
    "tooltipMarkup",
]);

const COMMON_SIGNALS = new Set(["destroy", "show", "hide", "map", "unmap"]);

const CROSS_NAMESPACE_TYPES = new Map([
    ["Gio.Application", "Gio.Application"],
    ["Gio.AppInfo", "Gio.AppInfo"],
    ["Gio.File", "Gio.File"],
    ["Gio.Icon", "Gio.Icon"],
    ["Gio.Menu", "Gio.Menu"],
    ["Gio.MenuModel", "Gio.MenuModel"],
    ["Gio.ListModel", "Gio.ListModel"],
    ["Gio.Action", "Gio.Action"],
    ["Gio.ActionGroup", "Gio.ActionGroup"],
    ["Gio.ActionMap", "Gio.ActionMap"],
]);

const isPrimitive = (tsType: string): boolean => {
    const primitives = new Set(["boolean", "number", "string", "void", "unknown", "null", "undefined"]);
    return primitives.has(tsType);
};

const isGObjectType = (girTypeName: string | undefined): boolean => {
    if (!girTypeName) return false;
    return (
        girTypeName.includes("Object") ||
        girTypeName.includes("GObject") ||
        girTypeName.includes(".Widget") ||
        girTypeName === "Widget" ||
        girTypeName.includes(".Window") ||
        girTypeName.includes(".Menu")
    );
};

const toJsxPropertyType = (tsType: string, girTypeName?: string): string => {
    let result = tsType;

    if (result.startsWith("Ref<")) {
        result = result.replace(/^Ref<(.+)>$/, "$1");
    }

    if (isPrimitive(result)) return result;

    if (result.endsWith("[]")) {
        const elementType = result.slice(0, -2);
        if (isPrimitive(elementType)) return result;
    }

    if (isGObjectType(girTypeName)) return "unknown";

    if (result.includes(".") || result.includes("<") || result.includes("(")) return result;

    return `Gtk.${result}`;
};

const isListWidget = (widgetName: string): boolean => LIST_WIDGETS.has(widgetName);
const isDropDownWidget = (widgetName: string): boolean => DROPDOWN_WIDGETS.has(widgetName);
const isGridWidget = (widgetName: string): boolean => GRID_WIDGETS.has(widgetName);

const formatDoc = (doc: string | undefined, indent: string = ""): string => {
    if (!doc) return "";
    const lines = doc.split("\n").map((line) => line.trim());
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
        const widgets = this.findWidgets(namespace, classMap);
        const dialogs = this.findDialogs(namespace, classMap, widgets);
        const containerMetadata = this.buildContainerMetadata(widgets, classMap);

        const widgetClass = classMap.get("Widget");

        const sections = [
            this.generateImports(),
            this.generateCommonTypes(widgetClass),
            this.generateWidgetPropsInterfaces(widgets, containerMetadata),
            this.generateDialogPropsInterfaces(dialogs),
            this.generateExports(widgets, dialogs, containerMetadata),
            this.generateJsxNamespace(widgets, dialogs, containerMetadata),
            "export {};",
        ];

        return this.formatCode(sections.join("\n"));
    }

    private generateImports(): string {
        return [
            `import type React from "react";`,
            `import type { ReactNode, Ref } from "react";`,
            `import type * as Gio from "@gtkx/ffi/gio";`,
            `import type * as Gtk from "@gtkx/ffi/gtk";`,
            "",
        ].join("\n");
    }

    private generateCommonTypes(widgetClass: GirClass | undefined): string {
        const widgetPropsContent = this.generateWidgetPropsContent(widgetClass);

        return `
export interface GtkComponent<P> {
\t(props: P): React.ReactElement | null;
}

${widgetPropsContent}
`;
    }

    private generateWidgetPropsContent(widgetClass: GirClass | undefined): string {
        const propDocs = new Map<string, string>();
        const signalDocs = new Map<string, string>();

        if (widgetClass) {
            for (const prop of widgetClass.properties) {
                if (prop.doc) {
                    propDocs.set(toCamelCase(prop.name), prop.doc);
                }
            }
            for (const signal of widgetClass.signals) {
                if (signal.doc) {
                    signalDocs.set(toCamelCase(signal.name), signal.doc);
                }
            }
        }

        const widgetDoc = widgetClass?.doc ? formatDoc(widgetClass.doc) : "";
        const lines: string[] = [];

        if (widgetDoc) {
            lines.push(widgetDoc.trimEnd());
        }
        lines.push("interface WidgetProps {");

        const addProp = (name: string, type: string): void => {
            const doc = propDocs.get(name);
            if (doc) {
                lines.push(formatDoc(doc, "\t").trimEnd());
            }
            lines.push(`\t${name}?: ${type};`);
        };

        const addSignal = (name: string, handler: string): void => {
            const signalName = name.replace(/^on/, "").toLowerCase();
            const doc = signalDocs.get(signalName);
            if (doc) {
                lines.push(formatDoc(doc, "\t").trimEnd());
            }
            lines.push(`\t${name}?: ${handler};`);
        };

        addProp("halign", 'Gtk.Align | "fill" | "start" | "end" | "center" | "baseline"');
        addProp("valign", 'Gtk.Align | "fill" | "start" | "end" | "center" | "baseline"');
        addProp("hexpand", "boolean");
        addProp("vexpand", "boolean");
        addProp("marginStart", "number");
        addProp("marginEnd", "number");
        addProp("marginTop", "number");
        addProp("marginBottom", "number");
        addProp("widthRequest", "number");
        addProp("heightRequest", "number");
        lines.push("");
        addProp("visible", "boolean");
        addProp("sensitive", "boolean");
        addProp("canFocus", "boolean");
        addProp("canTarget", "boolean");
        addProp("focusOnClick", "boolean");
        addProp("opacity", "number");
        lines.push("");
        addProp("cssClasses", "string[]");
        lines.push("");
        addProp("tooltipText", "string");
        addProp("tooltipMarkup", "string");
        lines.push("");
        addSignal("onDestroy", "() => void");
        addSignal("onShow", "() => void");
        addSignal("onHide", "() => void");
        addSignal("onMap", "() => void");
        addSignal("onUnmap", "() => void");
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

    private findDialogs(namespace: GirNamespace, _classMap: Map<string, GirClass>, widgets: GirClass[]): GirClass[] {
        const widgetNames = new Set(widgets.map((w) => w.name));

        return namespace.classes
            .filter((cls) => cls.name.endsWith("Dialog") && !widgetNames.has(cls.name) && cls.name !== "Dialog")
            .sort((a, b) => a.name.localeCompare(b.name));
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

            for (const slot of metadata.namedChildSlots) {
                const widgetName = toPascalCase(widget.name);
                sections.push(`interface ${widgetName}_${slot.slotName}_Props {\n\tchildren?: ReactNode;\n}\n`);
            }

            if (isListWidget(widget.name)) {
                const widgetName = toPascalCase(widget.name);
                sections.push(`interface ${widgetName}_Item_Props<T> {\n\titem: T;\n}\n`);
            }

            if (isDropDownWidget(widget.name)) {
                const widgetName = toPascalCase(widget.name);
                sections.push(`interface ${widgetName}_Item_Props<T> {\n\titem: T;\n}\n`);
            }

            if (isGridWidget(widget.name)) {
                const widgetName = toPascalCase(widget.name);
                sections.push(
                    `interface ${widgetName}_Child_Props {\n\tcolumn?: number;\n\trow?: number;\n\tcolumnSpan?: number;\n\trowSpan?: number;\n\tchildren?: ReactNode;\n}\n`,
                );
            }
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
        lines.push(`interface ${widgetName}Props extends ${parentPropsName} {`);

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
        for (const ifaceName of widget.implements) {
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
            return !COMMON_WIDGET_PROPS.has(propName) && !namedChildPropNames.has(propName);
        });

        for (const prop of specificProps) {
            const propName = toCamelCase(prop.name);
            const typeMapping = this.typeMapper.mapType(prop.type);
            const tsType = toJsxPropertyType(typeMapping.ts, prop.type.name);
            const isRequired = prop.constructOnly && !prop.hasDefault;
            if (prop.doc) {
                lines.push(formatDoc(prop.doc, "\t").trimEnd());
            }
            lines.push(`\t${propName}${isRequired ? "" : "?"}: ${tsType};`);
        }

        const specificSignals = allSignals.filter((signal) => {
            const signalName = toCamelCase(signal.name);
            return !COMMON_SIGNALS.has(signalName);
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
            lines.push(`\trenderItem?: <T>(item: T) => Gtk.Widget;`);
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

    private generateSignalHandler(signal: GirSignal): string {
        const signalName = toCamelCase(signal.name);
        const handlerName = `on${signalName.charAt(0).toUpperCase()}${signalName.slice(1)}`;
        const handlerType = this.buildSignalHandlerType(signal);
        return `${handlerName}?: ${handlerType};`;
    }

    private getSignalParamFfiType(typeName: string | undefined): string | undefined {
        if (!typeName) return undefined;

        const crossNsType = CROSS_NAMESPACE_TYPES.get(typeName);
        if (crossNsType) return crossNsType;

        if (typeName.includes(".")) {
            const [ns, className] = typeName.split(".", 2);
            if (ns === this.namespace && className && this.classMap.has(className)) {
                return `Gtk.${toPascalCase(className)}`;
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

    private generateDialogPropsInterfaces(dialogs: GirClass[]): string {
        return dialogs.map((dialog) => this.generateDialogProps(dialog)).join("\n");
    }

    private generateDialogProps(dialog: GirClass): string {
        const dialogName = toPascalCase(dialog.name);
        const lines: string[] = [];
        if (dialog.doc) {
            lines.push(formatDoc(dialog.doc).trimEnd());
        }
        lines.push(`interface ${dialogName}Props {`);

        if (dialog.name === "FileDialog") {
            lines.push(`\tmode?: "open" | "save" | "selectFolder" | "openMultiple";`);
            lines.push("");
        }

        for (const prop of dialog.properties) {
            if (!prop.writable) continue;
            const propName = toCamelCase(prop.name);
            const typeMapping = this.typeMapper.mapType(prop.type);
            const tsType = toJsxPropertyType(typeMapping.ts, prop.type.name);
            const isRequired = prop.constructOnly && !prop.hasDefault;
            if (prop.doc) {
                lines.push(formatDoc(prop.doc, "\t").trimEnd());
            }
            lines.push(`\t${propName}${isRequired ? "" : "?"}: ${tsType};`);
        }

        if (dialog.signals?.length > 0) {
            lines.push("");
            for (const signal of dialog.signals) {
                if (signal.doc) {
                    lines.push(formatDoc(signal.doc, "\t").trimEnd());
                }
                lines.push(`\t${this.generateSignalHandler(signal)}`);
            }
        }

        lines.push("");
        lines.push(`\tref?: Ref<Gtk.${dialogName}>;`);
        lines.push(`}`);

        return `${lines.join("\n")}\n`;
    }

    private generateExports(
        widgets: GirClass[],
        dialogs: GirClass[],
        containerMetadata: Map<string, ContainerMetadata>,
    ): string {
        const lines: string[] = [];

        for (const widget of widgets) {
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
                const typeMembers = [
                    `Root: GtkComponent<${propsName}>`,
                    ...metadata.namedChildSlots.map(
                        (slot) => `${slot.slotName}: GtkComponent<${widgetName}_${slot.slotName}_Props>`,
                    ),
                    ...(isListWidget(widget.name) ? [`Item: GtkComponent<${widgetName}_Item_Props<any>>`] : []),
                    ...(isDropDownWidget(widget.name) ? [`Item: GtkComponent<${widgetName}_Item_Props<any>>`] : []),
                    ...(isGridWidget(widget.name) ? [`Child: GtkComponent<${widgetName}_Child_Props>`] : []),
                ];
                const valueMembers = [
                    `Root: "${widgetName}" as unknown as GtkComponent<${propsName}>`,
                    ...metadata.namedChildSlots.map(
                        (slot) =>
                            `${slot.slotName}: "${widgetName}.${slot.slotName}" as unknown as GtkComponent<${widgetName}_${slot.slotName}_Props>`,
                    ),
                    ...(isListWidget(widget.name)
                        ? [`Item: "${widgetName}.Item" as unknown as GtkComponent<${widgetName}_Item_Props<any>>`]
                        : []),
                    ...(isDropDownWidget(widget.name)
                        ? [`Item: "${widgetName}.Item" as unknown as GtkComponent<${widgetName}_Item_Props<any>>`]
                        : []),
                    ...(isGridWidget(widget.name)
                        ? [`Child: "${widgetName}.Child" as unknown as GtkComponent<${widgetName}_Child_Props>`]
                        : []),
                ];
                lines.push(
                    `export const ${widgetName}: {\n\t${typeMembers.join(";\n\t")};\n} = {\n\t${valueMembers.join(",\n\t")},\n};`,
                );
            } else {
                lines.push(
                    `export const ${widgetName}: GtkComponent<${propsName}> = "${widgetName}" as unknown as GtkComponent<${propsName}>;`,
                );
            }
        }

        for (const dialog of dialogs) {
            const dialogName = toPascalCase(dialog.name);
            const propsName = `${dialogName}Props`;
            lines.push(
                `export const ${dialogName}: GtkComponent<${propsName}> = "${dialogName}" as unknown as GtkComponent<${propsName}>;`,
            );
        }

        return `${lines.join("\n")}\n`;
    }

    private generateJsxNamespace(
        widgets: GirClass[],
        dialogs: GirClass[],
        containerMetadata: Map<string, ContainerMetadata>,
    ): string {
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
                elements.push(`"${widgetName}.${slot.slotName}": ${widgetName}_${slot.slotName}_Props;`);
            }

            if (isListWidget(widget.name)) {
                elements.push(`"${widgetName}.Item": ${widgetName}_Item_Props<any>;`);
            }

            if (isDropDownWidget(widget.name)) {
                elements.push(`"${widgetName}.Item": ${widgetName}_Item_Props<any>;`);
            }

            if (isGridWidget(widget.name)) {
                elements.push(`"${widgetName}.Child": ${widgetName}_Child_Props;`);
            }
        }

        for (const dialog of dialogs) {
            const dialogName = toPascalCase(dialog.name);
            elements.push(`${dialogName}: ${dialogName}Props;`);
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
