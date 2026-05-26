import { describe, expect, it } from "vitest";
import { fileBuilder, stringify } from "../../../../src/builders/index.js";
import type { CodegenLayoutManagerMeta } from "../../../../src/codegen-metadata.js";
import { LayoutManagerPropsBuilder } from "../../../../src/react/generators/jsx-types/layout-manager-props-builder.js";
import { createPropertyAnalysis, createSignalAnalysis } from "../../../fixtures/metadata-fixtures.js";

function layoutManagerMeta(overrides: Partial<CodegenLayoutManagerMeta> = {}): CodegenLayoutManagerMeta {
    return {
        className: "BoxLayout",
        namespace: "Gtk",
        jsxName: "GtkBoxLayout",
        parentClassName: "LayoutManager",
        parentNamespace: "Gtk",
        propNames: [],
        signalNames: [],
        properties: [createPropertyAnalysis({ name: "spacing", camelName: "spacing", type: "number" })],
        signals: [createSignalAnalysis({ name: "notify", camelName: "notify", handlerName: "onNotify" })],
        doc: undefined,
        abstract: false,
        ...overrides,
    };
}

function declarationToString(
    builder: LayoutManagerPropsBuilder,
    decl: NonNullable<ReturnType<LayoutManagerPropsBuilder["buildLayoutManagerPropsInterface"]>>,
): string {
    void builder;
    const file = fileBuilder();
    file.add(decl);
    return stringify(file);
}

describe("LayoutManagerPropsBuilder / buildBaseLayoutManagerPropsInterface", () => {
    it("emits a LayoutManagerBaseProps interface with optional props, signals, and children", () => {
        const builder = new LayoutManagerPropsBuilder();
        const meta = layoutManagerMeta({
            className: "LayoutManager",
            jsxName: "GtkLayoutManager",
            parentClassName: null,
            parentNamespace: null,
        });

        const decl = builder.buildBaseLayoutManagerPropsInterface(meta);
        const file = fileBuilder();
        file.add(decl);
        const code = stringify(file);

        expect(code).toContain("interface LayoutManagerBaseProps");
        expect(code).toContain("spacing?:");
        expect(code).toContain("onNotify?:");
        expect(code).toContain("children?: ReactNode");
    });

    it("uses the layout manager doc when one is provided", () => {
        const builder = new LayoutManagerPropsBuilder();
        const meta = layoutManagerMeta({
            className: "LayoutManager",
            doc: "Base class for widget layout managers.",
        });

        const decl = builder.buildBaseLayoutManagerPropsInterface(meta);
        const file = fileBuilder();
        file.add(decl);
        const code = stringify(file);

        expect(code).toContain("Base class for widget layout managers");
    });

    it("falls back to a generic doc when no layout manager doc is provided", () => {
        const builder = new LayoutManagerPropsBuilder();
        const meta = layoutManagerMeta({ className: "LayoutManager", doc: undefined });

        const decl = builder.buildBaseLayoutManagerPropsInterface(meta);
        const file = fileBuilder();
        file.add(decl);
        const code = stringify(file);

        expect(code).toContain("Base props for all layout manager elements");
    });
});

describe("LayoutManagerPropsBuilder / buildLayoutManagerPropsInterface", () => {
    it("returns null for the base LayoutManager class", () => {
        const builder = new LayoutManagerPropsBuilder();
        const result = builder.buildLayoutManagerPropsInterface(layoutManagerMeta({ className: "LayoutManager" }));
        expect(result).toBeNull();
    });

    it("emits a Props interface with optional props, signals, and a ref", () => {
        const builder = new LayoutManagerPropsBuilder();
        const decl = builder.buildLayoutManagerPropsInterface(layoutManagerMeta());
        expect(decl).not.toBeNull();
        const code = declarationToString(builder, decl as NonNullable<typeof decl>);

        expect(code).toContain("interface GtkBoxLayoutProps");
        expect(code).toContain("spacing?:");
        expect(code).toContain("onNotify?:");
        expect(code).toContain("ref?: Ref<Gtk.BoxLayout>");
    });

    it("extends LayoutManagerBaseProps when the parent is the base LayoutManager", () => {
        const builder = new LayoutManagerPropsBuilder();
        const decl = builder.buildLayoutManagerPropsInterface(
            layoutManagerMeta({
                className: "GridLayout",
                jsxName: "GtkGridLayout",
                parentClassName: "LayoutManager",
            }),
        );

        const code = declarationToString(builder, decl as NonNullable<typeof decl>);
        expect(code).toContain("extends LayoutManagerBaseProps");
    });

    it("extends the parent layout manager props for a deeper class hierarchy", () => {
        const builder = new LayoutManagerPropsBuilder();
        builder.setKnownJsxNames(new Set(["GtkBoxLayout", "GtkConstraintLayout"]));
        const decl = builder.buildLayoutManagerPropsInterface(
            layoutManagerMeta({
                className: "ConstraintLayout",
                jsxName: "GtkConstraintLayout",
                parentClassName: "BoxLayout",
                parentNamespace: "Gtk",
            }),
        );

        const code = declarationToString(builder, decl as NonNullable<typeof decl>);
        expect(code).toContain("extends GtkBoxLayoutProps");
    });
});
