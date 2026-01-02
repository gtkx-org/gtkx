import { describe, expect, it } from "vitest";
import { CodegenMetadata } from "../../src/core/codegen-metadata.js";
import {
    createButtonMeta,
    createCodegenWidgetMeta,
    createLabelMeta,
    createWidgetMeta,
    createWindowMeta,
} from "../fixtures/metadata-fixtures.js";
import { createTestProject, createTestSourceFile } from "../fixtures/ts-morph-helpers.js";

describe("CodegenMetadata", () => {
    describe("setWidgetMeta / getWidgetMeta", () => {
        it("stores and retrieves widget metadata", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "button.ts");
            const widgetMeta = createButtonMeta();

            metadata.setWidgetMeta(sourceFile, widgetMeta);
            const result = metadata.getWidgetMeta(sourceFile);

            expect(result).toEqual(widgetMeta);
        });

        it("returns null for unknown source file", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "unknown.ts");

            const result = metadata.getWidgetMeta(sourceFile);

            expect(result).toBeNull();
        });

        it("overwrites existing metadata for same source file", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "button.ts");

            const firstMeta = createButtonMeta({ className: "OldButton" });
            const secondMeta = createButtonMeta({ className: "NewButton" });

            metadata.setWidgetMeta(sourceFile, firstMeta);
            metadata.setWidgetMeta(sourceFile, secondMeta);

            const result = metadata.getWidgetMeta(sourceFile);
            expect(result?.className).toBe("NewButton");
        });

        it("stores metadata for different source files independently", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();
            const buttonFile = createTestSourceFile(project, "button.ts");
            const windowFile = createTestSourceFile(project, "window.ts");

            const buttonMeta = createButtonMeta();
            const windowMeta = createWindowMeta();

            metadata.setWidgetMeta(buttonFile, buttonMeta);
            metadata.setWidgetMeta(windowFile, windowMeta);

            expect(metadata.getWidgetMeta(buttonFile)?.className).toBe("Button");
            expect(metadata.getWidgetMeta(windowFile)?.className).toBe("Window");
        });
    });

    describe("getAllWidgetMeta", () => {
        it("returns empty array when no metadata stored", () => {
            const metadata = new CodegenMetadata();

            const result = metadata.getAllWidgetMeta();

            expect(result).toEqual([]);
        });

        it("returns all stored widget metadata", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();

            const buttonFile = createTestSourceFile(project, "button.ts");
            const windowFile = createTestSourceFile(project, "window.ts");
            const labelFile = createTestSourceFile(project, "label.ts");

            metadata.setWidgetMeta(buttonFile, createButtonMeta());
            metadata.setWidgetMeta(windowFile, createWindowMeta());
            metadata.setWidgetMeta(labelFile, createLabelMeta());

            const result = metadata.getAllWidgetMeta();

            expect(result).toHaveLength(3);
            expect(result.map((m) => m.className)).toContain("Button");
            expect(result.map((m) => m.className)).toContain("Window");
            expect(result.map((m) => m.className)).toContain("Label");
        });

        it("returns metadata in insertion order", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();

            const files = ["first.ts", "second.ts", "third.ts"];
            const classNames = ["First", "Second", "Third"];

            files.forEach((file, i) => {
                const sourceFile = createTestSourceFile(project, file);
                metadata.setWidgetMeta(sourceFile, createCodegenWidgetMeta({ className: classNames[i] }));
            });

            const result = metadata.getAllWidgetMeta();

            expect(result.map((m) => m.className)).toEqual(["First", "Second", "Third"]);
        });

        it("does not return overwritten metadata", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "button.ts");

            metadata.setWidgetMeta(sourceFile, createButtonMeta({ className: "OldButton" }));
            metadata.setWidgetMeta(sourceFile, createButtonMeta({ className: "NewButton" }));

            const result = metadata.getAllWidgetMeta();

            expect(result).toHaveLength(1);
            expect(result[0]?.className).toBe("NewButton");
        });
    });

    describe("clear", () => {
        it("removes all stored metadata", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();

            const buttonFile = createTestSourceFile(project, "button.ts");
            const windowFile = createTestSourceFile(project, "window.ts");

            metadata.setWidgetMeta(buttonFile, createButtonMeta());
            metadata.setWidgetMeta(windowFile, createWindowMeta());

            metadata.clear();

            expect(metadata.getAllWidgetMeta()).toHaveLength(0);
            expect(metadata.getWidgetMeta(buttonFile)).toBeNull();
            expect(metadata.getWidgetMeta(windowFile)).toBeNull();
        });

        it("allows adding metadata after clear", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "button.ts");

            metadata.setWidgetMeta(sourceFile, createButtonMeta());
            metadata.clear();
            metadata.setWidgetMeta(sourceFile, createWindowMeta());

            expect(metadata.getWidgetMeta(sourceFile)?.className).toBe("Window");
        });

        it("handles clear on empty metadata", () => {
            const metadata = new CodegenMetadata();

            expect(() => metadata.clear()).not.toThrow();
            expect(metadata.getAllWidgetMeta()).toHaveLength(0);
        });
    });

    describe("metadata structure", () => {
        it("stores all widget metadata properties", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "widget.ts");

            const widgetMeta = createWidgetMeta();
            metadata.setWidgetMeta(sourceFile, widgetMeta);

            const result = metadata.getWidgetMeta(sourceFile);

            expect(result).toMatchObject({
                className: "Widget",
                namespace: "Gtk",
                jsxName: "GtkWidget",
                parentClassName: null,
                parentNamespace: null,
            });
            expect(result?.propNames).toContain("visible");
            expect(result?.signalNames).toContain("destroy");
        });

        it("stores cross-namespace inheritance info", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "header-bar.ts");

            const adwMeta = createCodegenWidgetMeta({
                className: "HeaderBar",
                namespace: "Adw",
                jsxName: "AdwHeaderBar",
                parentClassName: "Widget",
                parentNamespace: "Gtk",
            });

            metadata.setWidgetMeta(sourceFile, adwMeta);
            const result = metadata.getWidgetMeta(sourceFile);

            expect(result?.namespace).toBe("Adw");
            expect(result?.parentClassName).toBe("Widget");
            expect(result?.parentNamespace).toBe("Gtk");
        });

        it("stores constructor params", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "box.ts");

            const boxMeta = createCodegenWidgetMeta({
                className: "Box",
                constructorParams: ["orientation", "spacing"],
            });

            metadata.setWidgetMeta(sourceFile, boxMeta);
            const result = metadata.getWidgetMeta(sourceFile);

            expect(result?.constructorParams).toEqual(["orientation", "spacing"]);
        });

        it("stores property analysis results", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "button.ts");

            const buttonMeta = createButtonMeta();
            metadata.setWidgetMeta(sourceFile, buttonMeta);

            const result = metadata.getWidgetMeta(sourceFile);

            expect(result?.properties).toHaveLength(2);
            expect(result?.properties.map((p) => p.name)).toContain("label");
            expect(result?.properties.map((p) => p.name)).toContain("icon-name");
        });

        it("stores signal analysis results", () => {
            const metadata = new CodegenMetadata();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "button.ts");

            const buttonMeta = createButtonMeta();
            metadata.setWidgetMeta(sourceFile, buttonMeta);

            const result = metadata.getWidgetMeta(sourceFile);

            expect(result?.signals).toHaveLength(2);
            expect(result?.signals.map((s) => s.name)).toContain("clicked");
            expect(result?.signals.map((s) => s.handlerName)).toContain("onClicked");
        });
    });

    describe("multiple metadata instances", () => {
        it("different CodegenMetadata instances are independent", () => {
            const metadata1 = new CodegenMetadata();
            const metadata2 = new CodegenMetadata();
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "button.ts");

            metadata1.setWidgetMeta(sourceFile, createButtonMeta());

            expect(metadata1.getWidgetMeta(sourceFile)).toBeDefined();
            expect(metadata2.getWidgetMeta(sourceFile)).toBeNull();
        });
    });
});
