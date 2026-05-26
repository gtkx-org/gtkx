/**
 * JSX Types Generator
 *
 * Generates JSX type definitions from:
 * - CodegenWidgetMeta: properties, signals, prop names, slots (from FFI generation)
 * - CodegenControllerMeta: properties, signals for event controllers
 */

import type { FileBuilder } from "../../../builders/index.js";
import type { CodegenControllerMeta, CodegenLayoutManagerMeta, CodegenWidgetMeta } from "../../../codegen-metadata.js";
import { RenderableSlotsRegistry } from "../../../config/index.js";
import { toCamelCase } from "../../../utils/naming.js";
import { type MetadataReader, sortWidgetsByClassName } from "../../metadata-reader.js";
import { ControllerPropsBuilder } from "./controller-props-builder.js";
import { IntrinsicElementsBuilder } from "./intrinsic-elements-builder.js";
import { LayoutManagerPropsBuilder } from "./layout-manager-props-builder.js";
import { WidgetPropsBuilder } from "./widget-props-builder.js";

export type JsxWidget = {
    className: string;
    jsxName: string;
    namespace: string;
    slots: readonly string[];
    hiddenProps: Set<string>;
    meta: CodegenWidgetMeta;
};

type JsxTypesGeneratorOptions = {
    compoundJsxNames?: ReadonlySet<string>;
    renderableSlots?: RenderableSlotsRegistry;
};

export class JsxTypesGenerator {
    private readonly propsBuilder = new WidgetPropsBuilder();
    private readonly controllerPropsBuilder = new ControllerPropsBuilder();
    private readonly layoutManagerPropsBuilder = new LayoutManagerPropsBuilder();
    private readonly intrinsicBuilder = new IntrinsicElementsBuilder();
    private readonly compoundJsxNames: ReadonlySet<string>;
    private readonly renderableSlots: RenderableSlotsRegistry;

    // biome-ignore lint/complexity/useMaxParams: layout-managers parallel widgets and controllers as first-class meta sources
    constructor(
        private readonly reader: MetadataReader,
        private readonly controllers: readonly CodegenControllerMeta[],
        private readonly layoutManagers: readonly CodegenLayoutManagerMeta[],
        private readonly namespaceNames: string[],
        options: JsxTypesGeneratorOptions = {},
    ) {
        this.compoundJsxNames = options.compoundJsxNames ?? new Set();
        this.renderableSlots = options.renderableSlots ?? new RenderableSlotsRegistry();
    }

    generate(file: FileBuilder): void {
        const widgets = this.getWidgets();
        const controllers = this.getControllers();
        const layoutManagers = this.getLayoutManagers();
        this.propsBuilder.clearUsedNamespaces();
        this.controllerPropsBuilder.clearUsedNamespaces();
        this.layoutManagerPropsBuilder.clearUsedNamespaces();

        const widgetJsxNames = new Set(widgets.map((w) => w.jsxName));
        const controllerJsxNames = new Set(controllers.map((c) => c.jsxName));
        const layoutManagerJsxNames = new Set(layoutManagers.map((l) => l.jsxName));
        this.propsBuilder.setKnownJsxNames(widgetJsxNames);
        this.controllerPropsBuilder.setKnownJsxNames(controllerJsxNames);
        this.layoutManagerPropsBuilder.setKnownJsxNames(layoutManagerJsxNames);

        this.generateBaseWidgetProps(file, widgets);
        this.generateWidgetPropsInterfaces(file, widgets);
        this.generateBaseControllerProps(file, controllers);
        this.generateControllerPropsInterfaces(file, controllers);
        this.generateBaseLayoutManagerProps(file, layoutManagers);
        this.generateLayoutManagerPropsInterfaces(file, layoutManagers);
        this.addImports(file, widgets, controllers, layoutManagers);

        this.intrinsicBuilder.buildWidgetSlotNamesType(file, widgets);
        this.intrinsicBuilder.buildWidgetExports(file, widgets, this.compoundJsxNames);
        this.intrinsicBuilder.buildControllerExports(file, controllers, this.compoundJsxNames);
        this.intrinsicBuilder.buildLayoutManagerExports(file, layoutManagers, this.compoundJsxNames);
        this.intrinsicBuilder.buildJsxNamespace(file, widgets, controllers, layoutManagers);
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

    private getLayoutManagers(): CodegenLayoutManagerMeta[] {
        return this.layoutManagers
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

    private addImports(
        file: FileBuilder,
        widgets: JsxWidget[],
        controllers: CodegenControllerMeta[],
        layoutManagers: CodegenLayoutManagerMeta[],
    ): void {
        file.addTypeImport("react", ["ReactNode", "Ref"]);

        const usedNamespaces = new Set<string>(["Gtk"]);
        for (const widget of widgets) {
            usedNamespaces.add(widget.namespace);
        }

        for (const controller of controllers) {
            usedNamespaces.add(controller.namespace);
        }

        for (const layoutManager of layoutManagers) {
            usedNamespaces.add(layoutManager.namespace);
        }

        for (const ns of this.propsBuilder.getUsedNamespaces()) {
            usedNamespaces.add(ns);
        }

        for (const ns of this.controllerPropsBuilder.getUsedNamespaces()) {
            usedNamespaces.add(ns);
        }

        for (const ns of this.layoutManagerPropsBuilder.getUsedNamespaces()) {
            usedNamespaces.add(ns);
        }

        const sorted = [...usedNamespaces].sort((a, b) => a.localeCompare(b));
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
        );

        file.add(iface);
    }

    private generateWidgetPropsInterfaces(file: FileBuilder, widgets: JsxWidget[]): void {
        for (const widget of widgets) {
            if (widget.className === "Widget") continue;

            const filteredProperties = widget.meta.properties.filter((p) => !widget.hiddenProps.has(p.camelName));
            const filteredSignals = widget.meta.signals.filter((s) => !widget.hiddenProps.has(s.handlerName));

            const renderableSlots = this.renderableSlots.get(widget.jsxName);
            const slotPropNames = new Set(
                widget.slots.map((slot) => toCamelCase(slot)).filter((name) => renderableSlots.has(name)),
            );
            this.propsBuilder.setSlotPropNames(slotPropNames);

            const iface = this.propsBuilder.buildWidgetSpecificPropsInterface(
                widget,
                filteredProperties,
                filteredSignals,
            );

            this.propsBuilder.setSlotPropNames(new Set());

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

    private generateBaseLayoutManagerProps(file: FileBuilder, layoutManagers: CodegenLayoutManagerMeta[]): void {
        const layoutManagerMeta = layoutManagers.find((l) => l.className === "LayoutManager");
        if (!layoutManagerMeta) return;

        const iface = this.layoutManagerPropsBuilder.buildBaseLayoutManagerPropsInterface(layoutManagerMeta);
        file.add(iface);
    }

    private generateLayoutManagerPropsInterfaces(file: FileBuilder, layoutManagers: CodegenLayoutManagerMeta[]): void {
        for (const layoutManager of layoutManagers) {
            const iface = this.layoutManagerPropsBuilder.buildLayoutManagerPropsInterface(layoutManager);
            if (iface) file.add(iface);
        }
    }
}
