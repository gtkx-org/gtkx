import { describe, expect, it } from "vitest";
import { fileBuilder, stringify } from "../../../../src/builders/index.js";
import type { CodegenControllerMeta } from "../../../../src/core/codegen-metadata.js";
import { ControllerPropsBuilder } from "../../../../src/react/generators/jsx-types/controller-props-builder.js";
import { createPropertyAnalysis, createSignalAnalysis } from "../../../fixtures/metadata-fixtures.js";

function controllerMeta(overrides: Partial<CodegenControllerMeta> = {}): CodegenControllerMeta {
    return {
        className: "GestureClick",
        namespace: "Gtk",
        jsxName: "GtkGestureClick",
        parentClassName: "GestureSingle",
        parentNamespace: "Gtk",
        propNames: [],
        signalNames: [],
        properties: [createPropertyAnalysis({ name: "exclusive", camelName: "exclusive", type: "boolean" })],
        signals: [createSignalAnalysis({ name: "pressed", camelName: "pressed", handlerName: "onPressed" })],
        doc: undefined,
        abstract: false,
        ...overrides,
    };
}

function declarationToString(
    builder: ControllerPropsBuilder,
    decl: NonNullable<ReturnType<ControllerPropsBuilder["buildControllerPropsInterface"]>>,
): string {
    void builder;
    const file = fileBuilder();
    file.add(decl);
    return stringify(file);
}

describe("ControllerPropsBuilder", () => {
    describe("buildBaseControllerPropsInterface", () => {
        it("emits an EventControllerBaseProps interface with optional props, signals, and children", () => {
            const builder = new ControllerPropsBuilder();
            const meta = controllerMeta({
                className: "EventController",
                jsxName: "GtkEventController",
                parentClassName: null,
                parentNamespace: null,
            });

            const decl = builder.buildBaseControllerPropsInterface(meta);
            const file = fileBuilder();
            file.add(decl);
            const code = stringify(file);

            expect(code).toContain("interface EventControllerBaseProps");
            expect(code).toContain("exclusive?:");
            expect(code).toContain("onPressed?:");
            expect(code).toContain("children?: ReactNode");
        });

        it("uses the controller doc when one is provided", () => {
            const builder = new ControllerPropsBuilder();
            const meta = controllerMeta({
                className: "EventController",
                doc: "Top-level controller for input events.",
            });

            const decl = builder.buildBaseControllerPropsInterface(meta);
            const file = fileBuilder();
            file.add(decl);
            const code = stringify(file);

            expect(code).toContain("Top-level controller for input events");
        });

        it("falls back to a generic doc when no controller doc is provided", () => {
            const builder = new ControllerPropsBuilder();
            const meta = controllerMeta({ className: "EventController", doc: undefined });

            const decl = builder.buildBaseControllerPropsInterface(meta);
            const file = fileBuilder();
            file.add(decl);
            const code = stringify(file);

            expect(code).toContain("Base props for all event controller elements");
        });
    });

    describe("buildControllerPropsInterface", () => {
        it("returns null for the base EventController class", () => {
            const builder = new ControllerPropsBuilder();
            const result = builder.buildControllerPropsInterface(controllerMeta({ className: "EventController" }));
            expect(result).toBeNull();
        });

        it("emits a Props interface with optional props, signals, and a ref", () => {
            const builder = new ControllerPropsBuilder();
            const decl = builder.buildControllerPropsInterface(controllerMeta());
            expect(decl).not.toBeNull();
            const code = declarationToString(builder, decl as NonNullable<typeof decl>);

            expect(code).toContain("interface GtkGestureClickProps");
            expect(code).toContain("exclusive?:");
            expect(code).toContain("onPressed?:");
            expect(code).toContain("ref?: Ref<Gtk.GestureClick>");
        });

        it("extends EventControllerBaseProps when the controller's parent is the base EventController", () => {
            const builder = new ControllerPropsBuilder();
            const decl = builder.buildControllerPropsInterface(
                controllerMeta({
                    className: "GestureSingle",
                    jsxName: "GtkGestureSingle",
                    parentClassName: "EventController",
                }),
            );

            const code = declarationToString(builder, decl as NonNullable<typeof decl>);
            expect(code).toContain("extends EventControllerBaseProps");
        });

        it("extends the parent controller props for a deeper class hierarchy", () => {
            const builder = new ControllerPropsBuilder();
            const decl = builder.buildControllerPropsInterface(
                controllerMeta({
                    className: "GestureClick",
                    jsxName: "GtkGestureClick",
                    parentClassName: "GestureSingle",
                    parentNamespace: "Gtk",
                }),
            );

            const code = declarationToString(builder, decl as NonNullable<typeof decl>);
            expect(code).toContain("extends GtkGestureSingleProps");
        });
    });
});
