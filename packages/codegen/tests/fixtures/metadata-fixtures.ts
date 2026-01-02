import type { CodegenWidgetMeta } from "../../src/core/codegen-metadata.js";
import type { PropertyAnalysis, SignalAnalysis, SignalParam } from "../../src/core/generator-types.js";

export function createPropertyAnalysis(overrides: Partial<PropertyAnalysis> = {}): PropertyAnalysis {
    return {
        name: "label",
        camelName: "label",
        type: "string",
        isRequired: false,
        isWritable: true,
        getter: "getLabel",
        setter: "setLabel",
        referencedNamespaces: [],
        ...overrides,
    };
}

export function createSignalParam(overrides: Partial<SignalParam> = {}): SignalParam {
    return {
        name: "object",
        type: "Widget",
        ...overrides,
    };
}

export function createSignalAnalysis(overrides: Partial<SignalAnalysis> = {}): SignalAnalysis {
    return {
        name: "clicked",
        camelName: "clicked",
        handlerName: "onClicked",
        parameters: [],
        returnType: "void",
        referencedNamespaces: [],
        ...overrides,
    };
}

export function createCodegenWidgetMeta(overrides: Partial<CodegenWidgetMeta> = {}): CodegenWidgetMeta {
    return {
        className: "Button",
        namespace: "Gtk",
        jsxName: "GtkButton",
        propNames: ["label", "icon-name"],
        signalNames: ["clicked"],
        parentClassName: "Widget",
        parentNamespace: "Gtk",
        modulePath: "./gtk/button.js",
        properties: [createPropertyAnalysis()],
        signals: [createSignalAnalysis()],
        constructorParams: [],
        ...overrides,
    };
}

export function createWidgetMeta(overrides: Partial<CodegenWidgetMeta> = {}): CodegenWidgetMeta {
    return createCodegenWidgetMeta({
        className: "Widget",
        jsxName: "GtkWidget",
        parentClassName: null,
        parentNamespace: null,
        modulePath: "./gtk/widget.js",
        propNames: ["visible", "sensitive", "can-focus"],
        signalNames: ["destroy", "show"],
        properties: [
            createPropertyAnalysis({ name: "visible", camelName: "visible", type: "boolean" }),
            createPropertyAnalysis({ name: "sensitive", camelName: "sensitive", type: "boolean" }),
            createPropertyAnalysis({ name: "can-focus", camelName: "canFocus", type: "boolean" }),
        ],
        signals: [
            createSignalAnalysis({ name: "destroy", camelName: "destroy", handlerName: "onDestroy" }),
            createSignalAnalysis({ name: "show", camelName: "show", handlerName: "onShow" }),
        ],
        ...overrides,
    });
}

export function createWindowMeta(overrides: Partial<CodegenWidgetMeta> = {}): CodegenWidgetMeta {
    return createCodegenWidgetMeta({
        className: "Window",
        jsxName: "GtkWindow",
        parentClassName: "Widget",
        parentNamespace: "Gtk",
        modulePath: "./gtk/window.js",
        propNames: ["title", "default-width", "default-height"],
        signalNames: ["close-request"],
        properties: [
            createPropertyAnalysis({ name: "title", camelName: "title", type: "string | null" }),
            createPropertyAnalysis({
                name: "default-width",
                camelName: "defaultWidth",
                type: "number",
            }),
            createPropertyAnalysis({
                name: "default-height",
                camelName: "defaultHeight",
                type: "number",
            }),
        ],
        signals: [
            createSignalAnalysis({
                name: "close-request",
                camelName: "closeRequest",
                handlerName: "onCloseRequest",
                returnType: "boolean",
            }),
        ],
        ...overrides,
    });
}

export function createButtonMeta(overrides: Partial<CodegenWidgetMeta> = {}): CodegenWidgetMeta {
    return createCodegenWidgetMeta({
        className: "Button",
        jsxName: "GtkButton",
        parentClassName: "Widget",
        parentNamespace: "Gtk",
        modulePath: "./gtk/button.js",
        propNames: ["label", "icon-name"],
        signalNames: ["clicked", "activate"],
        properties: [
            createPropertyAnalysis({ name: "label", camelName: "label", type: "string | null" }),
            createPropertyAnalysis({
                name: "icon-name",
                camelName: "iconName",
                type: "string | null",
            }),
        ],
        signals: [
            createSignalAnalysis({ name: "clicked", camelName: "clicked", handlerName: "onClicked" }),
            createSignalAnalysis({ name: "activate", camelName: "activate", handlerName: "onActivate" }),
        ],
        constructorParams: ["label"],
        ...overrides,
    });
}

export function createLabelMeta(overrides: Partial<CodegenWidgetMeta> = {}): CodegenWidgetMeta {
    return createCodegenWidgetMeta({
        className: "Label",
        jsxName: "GtkLabel",
        parentClassName: "Widget",
        parentNamespace: "Gtk",
        modulePath: "./gtk/label.js",
        propNames: ["label", "use-markup", "wrap"],
        signalNames: [],
        properties: [
            createPropertyAnalysis({ name: "label", camelName: "label", type: "string | null" }),
            createPropertyAnalysis({ name: "use-markup", camelName: "useMarkup", type: "boolean" }),
            createPropertyAnalysis({ name: "wrap", camelName: "wrap", type: "boolean" }),
        ],
        signals: [],
        constructorParams: ["label"],
        ...overrides,
    });
}

export function createAdwHeaderBarMeta(overrides: Partial<CodegenWidgetMeta> = {}): CodegenWidgetMeta {
    return createCodegenWidgetMeta({
        className: "HeaderBar",
        namespace: "Adw",
        jsxName: "AdwHeaderBar",
        parentClassName: "Widget",
        parentNamespace: "Gtk",
        modulePath: "./adw/header-bar.js",
        propNames: ["title-widget", "show-back-button"],
        signalNames: [],
        properties: [
            createPropertyAnalysis({
                name: "title-widget",
                camelName: "titleWidget",
                type: "Widget | null",
                referencedNamespaces: ["Gtk"],
            }),
            createPropertyAnalysis({
                name: "show-back-button",
                camelName: "showBackButton",
                type: "boolean",
            }),
        ],
        signals: [],
        ...overrides,
    });
}
