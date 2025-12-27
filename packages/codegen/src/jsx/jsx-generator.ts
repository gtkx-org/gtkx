import type { GirClass, GirInterface, GirNamespace, GirSignal, TypeMapper, TypeRegistry } from "@gtkx/gir";
import { formatDoc as formatDocBase, toCamelCase, toPascalCase } from "@gtkx/gir";
import { format } from "prettier";
import { COLUMN_VIEW_WIDGET, DROPDOWN_WIDGETS, HIDDEN_PROPS, LIST_WIDGETS } from "./constants.js";

type JsxGeneratorOptions = {
    prettierConfig?: unknown;
};

type JsxGeneratorResult = {
    jsx: string;
    internal: string;
    registry: string;
};

type WidgetInfo = {
    widget: GirClass;
    namespace: string;
};

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

export class JsxGenerator {
    private interfaceMap: Map<string, GirInterface> = new Map();
    private usedNamespaces: Set<string> = new Set();
    private widgetPropertyNames: Set<string> = new Set();
    private widgetSignalNames: Set<string> = new Set();
    private currentNamespace = "";
    private widgetNamespaceMap: Map<string, string> = new Map();

    constructor(
        private typeMapper: TypeMapper,
        private typeRegistry: TypeRegistry,
        private classMap: Map<string, GirClass>,
        private options: JsxGeneratorOptions = {},
    ) {}

    private formatDoc(doc: string | undefined, indent: string = ""): string {
        return formatDocBase(doc, indent, {
            namespace: this.currentNamespace,
            escapeXmlTags: true,
            linkStyle: "prefixed",
        });
    }

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

        const widgetClass = this.classMap.get("Widget") ?? this.classMap.get("Gtk.Widget");

        this.widgetPropertyNames = new Set(widgetClass?.properties.map((p) => toCamelCase(p.name)) ?? []);
        this.widgetSignalNames = new Set(widgetClass?.signals.map((s) => toCamelCase(s.name)) ?? []);

        const commonTypes = this.generateCommonTypes(widgetClass);
        const widgetPropsInterfaces = this.generateWidgetPropsInterfaces(allWidgets);
        const widgetSlotNamesType = this.generateWidgetSlotNamesType(allWidgets);
        const exports = this.generateExports(allWidgets);
        const jsxNamespace = this.generateJsxNamespace(allWidgets);

        const imports = this.generateImports();

        const jsxSections = [
            imports,
            commonTypes,
            widgetPropsInterfaces,
            widgetSlotNamesType,
            exports,
            jsxNamespace,
            "export {};",
        ];

        const internalSections = [
            this.generateInternalImports(),
            this.generateConstructorPropsMetadata(allWidgets),
            this.generatePropsMap(allWidgets),
            this.generateSignalNamesMap(allWidgets),
        ];

        const widgetNamespaces = [...new Set(allWidgets.map((w) => w.namespace))];
        const registryCode = this.generateNamespaceRegistry(widgetNamespaces);

        return {
            jsx: await this.formatCode(jsxSections.join("\n")),
            internal: await this.formatCode(internalSections.join("\n")),
            registry: await this.formatCode(registryCode),
        };
    }

    private generateImports(): string {
        this.usedNamespaces.add("Gtk");

        const namespaceImports = [...this.usedNamespaces]
            .sort()
            .map((ns) => `import type * as ${ns} from "@gtkx/ffi/${ns.toLowerCase()}";`);

        return [`import type { ReactNode, Ref } from "react";`, ...namespaceImports, ""].join("\n");
    }

    private generateInternalImports(): string {
        return "/** Internal metadata for the reconciler. Not part of the public API. */\n";
    }

    private generateNamespaceRegistry(widgetNamespaces: string[]): string {
        const sortedByLength = [...widgetNamespaces].sort((a, b) => b.length - a.length || a.localeCompare(b));
        const sortedAlphabetically = [...widgetNamespaces].sort();

        const imports = sortedAlphabetically.map((ns) => `import * as ${ns} from "@gtkx/ffi/${ns.toLowerCase()}";`);
        const registryEntries = sortedByLength.map((ns) => `    ["${ns}", ${ns}],`);

        return [
            "/** Generated namespace registry for widget class resolution. */",
            "",
            ...imports,
            "",
            "type Namespace = Record<string, unknown>;",
            "",
            "export const NAMESPACE_REGISTRY: [string, Namespace][] = [",
            ...registryEntries,
            "];",
            "",
        ].join("\n");
    }

    private generateCommonTypes(widgetClass: GirClass | undefined): string {
        this.currentNamespace = "Gtk";
        this.typeMapper.setTypeRegistry(this.typeRegistry, "Gtk");
        const widgetPropsContent = this.generateWidgetPropsContent(widgetClass);

        return `\n${widgetPropsContent}\n`;
    }

    private generateWidgetPropsContent(widgetClass: GirClass | undefined): string {
        const lines: string[] = [];
        const widgetDoc = widgetClass?.doc ? this.formatDoc(widgetClass.doc) : "";

        if (widgetDoc) {
            lines.push(widgetDoc.trimEnd());
        }
        lines.push("export interface WidgetProps {");

        if (widgetClass) {
            for (const prop of widgetClass.properties) {
                const propName = toCamelCase(prop.name);
                const tsType = this.toJsxPropertyType(this.typeMapper.mapType(prop.type).ts, "Gtk");

                if (prop.doc) {
                    lines.push(this.formatDoc(prop.doc, "\t").trimEnd());
                }
                lines.push(`\t${propName}?: ${tsType};`);
            }

            if (widgetClass.signals.length > 0) {
                lines.push("");
                for (const signal of widgetClass.signals) {
                    if (signal.doc) {
                        lines.push(this.formatDoc(signal.doc, "\t").trimEnd());
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

    private generateWidgetPropsInterfaces(widgets: WidgetInfo[]): string {
        const sections: string[] = [];

        for (const { widget, namespace } of widgets) {
            if (widget.name === "Widget") continue;

            this.currentNamespace = namespace;
            this.usedNamespaces.add(namespace);
            this.typeMapper.setTypeRegistry(this.typeRegistry, namespace);
            sections.push(this.generateWidgetProps(widget));
        }

        return sections.join("\n");
    }

    private getWidgetExportName(widget: GirClass): string {
        const baseName = toPascalCase(widget.name);
        return `${this.currentNamespace}${baseName}`;
    }

    private generateWidgetProps(widget: GirClass): string {
        const widgetName = this.getWidgetExportName(widget);
        const parentPropsName = this.getParentPropsName(widget);

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

        const hiddenProps = new Set(HIDDEN_PROPS[widget.name] ?? []);

        const specificProps = allProps.filter((prop) => {
            const propName = toCamelCase(prop.name);
            return !this.widgetPropertyNames.has(propName) && !hiddenProps.has(propName);
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
                lines.push(this.formatDoc(prop.doc, "\t").trimEnd());
            }
            lines.push(`\t${propName}${isRequired ? "" : "?"}: ${tsType};`);
        }

        for (const paramName of requiredCtorParams) {
            const propName = toCamelCase(paramName);
            if (emittedProps.has(paramName) || hiddenProps.has(propName)) continue;
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
                    lines.push(this.formatDoc(signal.doc, "\t").trimEnd());
                }
                lines.push(`\t${this.generateSignalHandler(signal, widget.name)}`);
            }
        }

        if (isListWidget(widgetName) || isColumnViewWidget(widgetName)) {
            lines.push("");
            lines.push(`\t/** Array of selected item IDs */`);
            lines.push(`\tselected?: string[];`);
            lines.push(`\t/** Called when selection changes with array of selected item IDs */`);
            lines.push(`\tonSelectionChanged?: (ids: string[]) => void;`);
            lines.push(`\t/** Selection mode: SINGLE (default) or MULTIPLE */`);
            lines.push(`\tselectionMode?: import("@gtkx/ffi/gtk").SelectionMode;`);
        }

        if (isColumnViewWidget(widgetName)) {
            lines.push("");
            lines.push(`\t/** ID of the currently sorted column, or null if unsorted */`);
            lines.push(`\tsortColumn?: string | null;`);
            lines.push(`\t/** The current sort direction */`);
            lines.push(`\tsortOrder?: import("@gtkx/ffi/gtk").SortType;`);
            lines.push(`\t/** Called when a column header is clicked to change sort */`);
            lines.push(`\tonSortChange?: (column: string | null, order: import("@gtkx/ffi/gtk").SortType) => void;`);
        }

        if (isListWidget(widgetName)) {
            lines.push("");
            lines.push(`\t/**`);
            lines.push(`\t * Render function for list items.`);
            lines.push(`\t * Called with null during setup (for loading state) and with the actual item during bind.`);
            lines.push(`\t */`);
            lines.push(`\trenderItem: (item: any) => import("react").ReactElement;`);
        }

        if (isDropDownWidget(widgetName)) {
            lines.push("");
            lines.push(`\t/** ID of the initially selected item */`);
            lines.push(`\tselectedId?: string;`);
            lines.push(`\t/** Called when selection changes with the selected item's ID */`);
            lines.push(`\tonSelectionChanged?: (id: string) => void;`);
        }

        lines.push("");
        const ffiTypeName = toPascalCase(widget.name);
        lines.push(`\tref?: Ref<${this.currentNamespace}.${ffiTypeName}>;`);
        lines.push(`}`);

        return `${lines.join("\n")}\n`;
    }

    private getParentPropsName(widget: GirClass): string {
        if (widget.name === "Window" && this.currentNamespace === "Gtk") return "WidgetProps";
        if (widget.name === "ApplicationWindow" && this.currentNamespace === "Gtk") return "GtkWindowProps";

        if (!widget.parent) return "WidgetProps";

        const parentNs = widget.parent.includes(".") ? widget.parent.split(".")[0] : this.currentNamespace;
        const parentName = widget.parent.includes(".") ? widget.parent.split(".")[1] : widget.parent;

        if (parentName === "Widget") return "WidgetProps";
        if (parentName === "Window") return `${parentNs}WindowProps`;

        const baseName = toPascalCase(parentName ?? "");
        return `${parentNs}${baseName}Props`;
    }

    private getRequiredConstructorParams(widget: GirClass): Set<string> {
        const required = new Set<string>();
        const mainCtor = widget.constructors.find((c) => c.name === "new");
        if (!mainCtor) return required;

        for (const param of mainCtor.parameters) {
            if (!param.nullable && !param.optional) {
                if (param.name === "application") continue;
                const normalizedName = param.name.replace(/_/g, "-");
                required.add(normalizedName);
            }
        }
        return required;
    }

    private getConstructorParams(widget: GirClass): string[] {
        const mainCtor = widget.constructors.find((c) => c.name === "new");
        if (!mainCtor) return [];

        const params = mainCtor.parameters.map((param) => ({
            name: toCamelCase(param.name),
            isOptional: param.nullable || param.optional || false,
        }));

        const required = params.filter((p) => !p.isOptional).map((p) => p.name);
        const optional = params.filter((p) => p.isOptional).map((p) => p.name);
        return [...required, ...optional];
    }

    private generateConstructorPropsMetadata(widgets: WidgetInfo[]): string {
        const entries: string[] = [];

        for (const { widget, namespace } of widgets) {
            const params = this.getConstructorParams(widget);
            if (params.length === 0) continue;

            this.currentNamespace = namespace;
            const widgetName = this.getWidgetExportName(widget);
            const paramStrs = params.map((p) => `"${p}"`);
            entries.push(`\t${widgetName}: [${paramStrs.join(", ")}]`);
        }

        if (entries.length === 0) {
            return `export const CONSTRUCTOR_PROPS: Record<string, string[]> = {};\n`;
        }

        return `export const CONSTRUCTOR_PROPS: Record<string, string[]> = {\n${entries.join(",\n")},\n};\n`;
    }

    private generatePropsMap(widgets: WidgetInfo[]): string {
        const widgetEntries: string[] = [];

        for (const { widget, namespace } of widgets) {
            this.currentNamespace = namespace;
            const propEntries: string[] = [];
            const allProps = this.collectAllProperties(widget);
            const parentMethodNames = this.collectParentMethodNames(widget);
            const widgetClassName = toPascalCase(widget.name);

            for (const prop of allProps) {
                if (prop.setter) {
                    const propName = toCamelCase(prop.name);
                    const setterName = toCamelCase(prop.setter);

                    let getterName: string | null = null;
                    if (prop.getter) {
                        getterName = toCamelCase(prop.getter);
                        if (parentMethodNames.has(prop.getter)) {
                            getterName = `${getterName}${widgetClassName}`;
                        }
                    }

                    const getterStr = getterName ? `"${getterName}"` : "null";
                    propEntries.push(`"${propName}": [${getterStr}, "${setterName}"]`);
                }
            }

            if (propEntries.length > 0) {
                const widgetName = this.getWidgetExportName(widget);
                widgetEntries.push(`\t${widgetName}: { ${propEntries.join(", ")} }`);
            }
        }

        if (widgetEntries.length === 0) {
            return `export const PROPS: Record<string, Record<string, [string | null, string]>> = {};\n`;
        }

        return `export const PROPS: Record<string, Record<string, [string | null, string]>> = {\n${widgetEntries.join(",\n")},\n};\n`;
    }

    private generateSignalNamesMap(widgets: WidgetInfo[]): string {
        const widgetEntries: string[] = [];

        for (const { widget, namespace } of widgets) {
            this.currentNamespace = namespace;
            const signals = this.collectAllSignals(widget);

            if (signals.length > 0) {
                const widgetName = this.getWidgetExportName(widget);
                const signalList = signals.map((s) => `"${s}"`).join(", ");
                widgetEntries.push(`\t${widgetName}: new Set([${signalList}])`);
            }
        }

        if (widgetEntries.length === 0) {
            return `export const SIGNALS: Record<string, Set<string>> = {};\n`;
        }

        return `export const SIGNALS: Record<string, Set<string>> = {\n${widgetEntries.join(",\n")},\n};\n`;
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

    private collectAllSignals(widget: GirClass): string[] {
        const signals: string[] = [];
        const seen = new Set<string>();

        let current: GirClass | undefined = widget;
        while (current) {
            for (const signal of current.signals) {
                if (!seen.has(signal.name)) {
                    seen.add(signal.name);
                    signals.push(signal.name);
                }
            }

            for (const ifaceName of current.implements) {
                const iface = this.interfaceMap.get(ifaceName);
                if (iface) {
                    for (const signal of iface.signals) {
                        if (!seen.has(signal.name)) {
                            seen.add(signal.name);
                            signals.push(signal.name);
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

        return signals;
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
        }

        const registered = this.typeRegistry.resolveInNamespace(typeName, this.currentNamespace);
        if (registered && (registered.kind === "class" || registered.kind === "interface")) {
            this.usedNamespaces.add(registered.namespace);
            if (registered.namespace === this.currentNamespace) {
                return `${this.currentNamespace}.${registered.transformedName}`;
            }
            return `${registered.namespace}.${registered.transformedName}`;
        }
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

    private generateExports(widgets: WidgetInfo[]): string {
        const lines: string[] = [];

        for (const { widget, namespace } of widgets) {
            this.currentNamespace = namespace;
            const widgetName = this.getWidgetExportName(widget);
            const docComment = widget.doc ? this.formatDoc(widget.doc).trimEnd() : "";

            if (docComment) {
                lines.push(`${docComment}\nexport const ${widgetName} = "${widgetName}" as const;`);
            } else {
                lines.push(`export const ${widgetName} = "${widgetName}" as const;`);
            }
        }

        return `${lines.join("\n")}\n`;
    }

    private generateJsxNamespace(widgets: WidgetInfo[]): string {
        const elements: string[] = [];

        for (const { widget, namespace } of widgets) {
            if (widget.name === "Widget") continue;

            this.currentNamespace = namespace;
            const widgetName = this.getWidgetExportName(widget);
            const propsName = `${widgetName}Props`;

            elements.push(`${widgetName}: ${propsName};`);
        }

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

    private generateWidgetSlotNamesType(widgets: WidgetInfo[]): string {
        const entries: string[] = [];

        for (const { widget, namespace } of widgets) {
            this.currentNamespace = namespace;
            const widgetName = this.getWidgetExportName(widget);

            const slotNames = widget.properties
                .filter((prop) => {
                    if (!prop.writable) return false;
                    const typeName = prop.type.name;
                    return (
                        typeName === "Gtk.Widget" || typeName === "Widget" || isWidgetSubclass(typeName, this.classMap)
                    );
                })
                .map((prop) => `"${toCamelCase(prop.name)}"`);

            if (slotNames.length > 0) {
                entries.push(`\t${widgetName}: ${slotNames.join(" | ")};`);
            }
        }

        if (entries.length === 0) {
            return "/** Type mapping widgets to their valid slot names. */\nexport type WidgetSlotNames = Record<string, never>;\n";
        }

        return [
            "/** Type mapping widgets to their valid slot names. Used for type-safe Slot components. */",
            "export type WidgetSlotNames = {",
            ...entries,
            "};",
            "",
        ].join("\n");
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
