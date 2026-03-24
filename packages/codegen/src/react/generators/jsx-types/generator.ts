/**
 * JSX Types Generator
 *
 * Generates JSX type definitions from:
 * - CodegenWidgetMeta: properties, signals, prop names, slots (from FFI generation)
 * - CodegenControllerMeta: properties, signals for event controllers
 */

import type { FileBuilder } from "../../../builders/index.js";
import type { CodegenControllerMeta, CodegenWidgetMeta } from "../../../core/codegen-metadata.js";
import { toCamelCase } from "../../../core/utils/naming.js";
import { type MetadataReader, sortWidgetsByClassName } from "../../metadata-reader.js";
import { ControllerPropsBuilder } from "./controller-props-builder.js";
import { IntrinsicElementsBuilder } from "./intrinsic-elements-builder.js";
import { WidgetPropsBuilder } from "./widget-props-builder.js";

export type JsxWidget = {
    className: string;
    jsxName: string;
    namespace: string;
    slots: readonly string[];
    hiddenProps: Set<string>;
    meta: CodegenWidgetMeta;
};

export class JsxTypesGenerator {
    private readonly propsBuilder = new WidgetPropsBuilder();
    private readonly controllerPropsBuilder = new ControllerPropsBuilder();
    private readonly intrinsicBuilder = new IntrinsicElementsBuilder();

    constructor(
        private readonly reader: MetadataReader,
        private readonly controllers: readonly CodegenControllerMeta[],
        private readonly namespaceNames: string[],
    ) {}

    generate(file: FileBuilder): void {
        const widgets = this.getWidgets();
        const controllers = this.getControllers();
        this.propsBuilder.clearUsedNamespaces();
        this.controllerPropsBuilder.clearUsedNamespaces();

        const widgetJsxNames = new Set(widgets.map((w) => w.jsxName));
        const controllerJsxNames = new Set(controllers.map((c) => c.jsxName));
        this.propsBuilder.setKnownJsxNames(widgetJsxNames);
        this.controllerPropsBuilder.setKnownJsxNames(controllerJsxNames);

        this.generateBaseWidgetProps(file, widgets);
        this.generateWidgetPropsInterfaces(file, widgets);
        this.generateBaseControllerProps(file, controllers);
        this.generateControllerPropsInterfaces(file, controllers);
        this.addImports(file, widgets, controllers);

        this.intrinsicBuilder.buildWidgetSlotNamesType(file, widgets);
        this.intrinsicBuilder.buildWidgetExports(file, widgets);
        this.intrinsicBuilder.buildControllerExports(file, controllers);
        this.intrinsicBuilder.buildJsxNamespace(file, widgets, controllers);
        this.intrinsicBuilder.addModuleExport(file);
    }

    private getWidgets(): JsxWidget[] {
        const allMeta = this.reader.getAllCodegenMeta();

        const filtered = allMeta.filter((m) => this.namespaceNames.includes(m.namespace));
        const widgets = filtered.map((meta) => this.toJsxWidget(meta));

        return sortWidgetsByClassName(widgets);
    }

    private getControllers(): CodegenControllerMeta[] {
        return this.controllers
            .filter((m) => this.namespaceNames.includes(m.namespace))
            .sort((a, b) => a.jsxName.localeCompare(b.jsxName));
    }

    private toJsxWidget(meta: CodegenWidgetMeta): JsxWidget {
        const hiddenProps = new Set(meta.hiddenPropNames);
        const filteredSlots = meta.slots.filter((slot) => !hiddenProps.has(toCamelCase(slot)));

        return {
            className: meta.className,
            jsxName: meta.jsxName,
            namespace: meta.namespace,
            slots: filteredSlots,
            hiddenProps,
            meta,
        };
    }

    private addImports(file: FileBuilder, widgets: JsxWidget[], controllers: CodegenControllerMeta[]): void {
        file.addTypeImport("react", ["ReactNode", "Ref"]);

        const usedNamespaces = new Set<string>(["Gtk"]);
        for (const widget of widgets) {
            usedNamespaces.add(widget.namespace);
        }

        for (const controller of controllers) {
            usedNamespaces.add(controller.namespace);
        }

        for (const ns of this.propsBuilder.getUsedNamespaces()) {
            usedNamespaces.add(ns);
        }

        for (const ns of this.controllerPropsBuilder.getUsedNamespaces()) {
            usedNamespaces.add(ns);
        }

        const sorted = [...usedNamespaces].sort();
        for (const ns of sorted) {
            file.addTypeNamespaceImport(`@gtkx/ffi/${ns.toLowerCase()}`, ns);
        }
    }

    private generateBaseWidgetProps(file: FileBuilder, widgets: JsxWidget[]): void {
        const widgetMeta = widgets.find((w) => w.className === "Widget");
        if (!widgetMeta) return;

        const iface = this.propsBuilder.buildWidgetPropsInterface(
            "Gtk",
            widgetMeta.meta.properties,
            widgetMeta.meta.signals,
            undefined,
        );

        file.add(iface);
    }

    private generateWidgetPropsInterfaces(file: FileBuilder, widgets: JsxWidget[]): void {
        for (const widget of widgets) {
            if (widget.className === "Widget") continue;

            const filteredProperties = widget.meta.properties.filter((p) => !widget.hiddenProps.has(p.camelName));
            const filteredSignals = widget.meta.signals.filter((s) => !widget.hiddenProps.has(s.handlerName));

            const iface = this.propsBuilder.buildWidgetSpecificPropsInterface(
                widget,
                filteredProperties,
                filteredSignals,
            );

            file.add(iface);
        }
    }

    private generateBaseControllerProps(file: FileBuilder, controllers: CodegenControllerMeta[]): void {
        const eventControllerMeta = controllers.find((c) => c.className === "EventController");
        if (!eventControllerMeta) return;

        const iface = this.controllerPropsBuilder.buildBaseControllerPropsInterface(eventControllerMeta);
        file.add(iface);
    }

    private generateControllerPropsInterfaces(file: FileBuilder, controllers: CodegenControllerMeta[]): void {
        for (const controller of controllers) {
            const iface = this.controllerPropsBuilder.buildControllerPropsInterface(controller);
            if (iface) file.add(iface);
        }
    }
}
