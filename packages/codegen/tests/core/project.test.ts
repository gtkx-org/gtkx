import { describe, expect, it } from "vitest";
import { CodegenMetadata } from "../../src/core/codegen-metadata.js";
import { CodegenProject } from "../../src/core/project.js";

describe("CodegenProject", () => {
    describe("constructor", () => {
        it("creates a project instance", () => {
            const project = new CodegenProject();
            expect(project).toBeInstanceOf(CodegenProject);
        });

        it("initializes with empty source files", () => {
            const project = new CodegenProject();
            expect(project.getSourceFiles()).toHaveLength(0);
        });

        it("creates metadata instance", () => {
            const project = new CodegenProject();
            expect(project.metadata).toBeInstanceOf(CodegenMetadata);
        });
    });

    describe("metadata", () => {
        it("returns the same metadata instance", () => {
            const project = new CodegenProject();
            const meta1 = project.metadata;
            const meta2 = project.metadata;
            expect(meta1).toBe(meta2);
        });

        it("allows storing and retrieving widget metadata", () => {
            const project = new CodegenProject();
            const sourceFile = project.createSourceFile("test.ts");
            const widgetMeta = {
                className: "Button",
                jsxName: "GtkButton",
                namespace: "Gtk",
                propNames: [],
                signalNames: [],
                parentClassName: null,
                parentNamespace: null,
                modulePath: "./gtk/button.js",
                constructorParams: [],
                properties: [],
                signals: [],
            };

            project.metadata.setWidgetMeta(sourceFile, widgetMeta);
            const result = project.metadata.getWidgetMeta(sourceFile);

            expect(result).toEqual(widgetMeta);
        });
    });

    describe("createSourceFile", () => {
        it("creates a new source file", () => {
            const project = new CodegenProject();
            const sourceFile = project.createSourceFile("test.ts");

            expect(sourceFile).toBeDefined();
            expect(sourceFile.getFilePath()).toBe("/test.ts");
        });

        it("creates source file at nested path", () => {
            const project = new CodegenProject();
            const sourceFile = project.createSourceFile("gtk/button.ts");

            expect(sourceFile.getFilePath()).toBe("/gtk/button.ts");
        });

        it("overwrites existing file with same path", () => {
            const project = new CodegenProject();
            const file1 = project.createSourceFile("test.ts");
            file1.addClass({ name: "OldClass" });

            const file2 = project.createSourceFile("test.ts");

            expect(file2.getClasses()).toHaveLength(0);
            expect(project.getSourceFiles()).toHaveLength(1);
        });

        it("can add content to created file", () => {
            const project = new CodegenProject();
            const sourceFile = project.createSourceFile("button.ts");
            sourceFile.addClass({ name: "Button" });

            expect(sourceFile.getClasses()).toHaveLength(1);
            expect(sourceFile.getClass("Button")).toBeDefined();
        });
    });

    describe("createFfiSourceFile", () => {
        it("creates file in ffi directory", () => {
            const project = new CodegenProject();
            const sourceFile = project.createFfiSourceFile("gtk/button.ts");

            expect(sourceFile.getFilePath()).toBe("/ffi/gtk/button.ts");
        });

        it("creates file at ffi root", () => {
            const project = new CodegenProject();
            const sourceFile = project.createFfiSourceFile("batch.ts");

            expect(sourceFile.getFilePath()).toBe("/ffi/batch.ts");
        });
    });

    describe("createReactSourceFile", () => {
        it("creates file in react directory", () => {
            const project = new CodegenProject();
            const sourceFile = project.createReactSourceFile("internal.ts");

            expect(sourceFile.getFilePath()).toBe("/react/internal.ts");
        });

        it("creates file at nested path in react", () => {
            const project = new CodegenProject();
            const sourceFile = project.createReactSourceFile("jsx-types/gtk.ts");

            expect(sourceFile.getFilePath()).toBe("/react/jsx-types/gtk.ts");
        });
    });

    describe("getSourceFile", () => {
        it("returns existing source file", () => {
            const project = new CodegenProject();
            project.createSourceFile("test.ts");

            const result = project.getSourceFile("test.ts");

            expect(result).not.toBeNull();
            expect(result?.getFilePath()).toBe("/test.ts");
        });

        it("returns null for non-existent file", () => {
            const project = new CodegenProject();

            const result = project.getSourceFile("nonexistent.ts");

            expect(result).toBeNull();
        });

        it("returns file created at nested path", () => {
            const project = new CodegenProject();
            project.createSourceFile("gtk/button.ts");

            const result = project.getSourceFile("gtk/button.ts");

            expect(result).not.toBeNull();
        });
    });

    describe("getSourceFiles", () => {
        it("returns empty array initially", () => {
            const project = new CodegenProject();

            expect(project.getSourceFiles()).toEqual([]);
        });

        it("returns all created source files", () => {
            const project = new CodegenProject();
            project.createSourceFile("file1.ts");
            project.createSourceFile("file2.ts");
            project.createSourceFile("file3.ts");

            const files = project.getSourceFiles();

            expect(files).toHaveLength(3);
        });

        it("returns files from different directories", () => {
            const project = new CodegenProject();
            project.createFfiSourceFile("gtk/button.ts");
            project.createReactSourceFile("internal.ts");
            project.createSourceFile("other.ts");

            const files = project.getSourceFiles();

            expect(files).toHaveLength(3);
        });
    });

    describe("getSourceFilesInNamespace", () => {
        it("returns files in namespace directory", () => {
            const project = new CodegenProject();
            project.createFfiSourceFile("gtk/button.ts");
            project.createFfiSourceFile("gtk/widget.ts");
            project.createFfiSourceFile("adw/window.ts");

            const gtkFiles = project.getSourceFilesInNamespace("Gtk");

            expect(gtkFiles).toHaveLength(2);
        });

        it("handles case-insensitive namespace matching", () => {
            const project = new CodegenProject();
            project.createFfiSourceFile("gtk/button.ts");

            const files1 = project.getSourceFilesInNamespace("Gtk");
            const files2 = project.getSourceFilesInNamespace("GTK");
            const files3 = project.getSourceFilesInNamespace("gtk");

            expect(files1).toHaveLength(1);
            expect(files2).toHaveLength(1);
            expect(files3).toHaveLength(1);
        });

        it("returns empty array for namespace with no files", () => {
            const project = new CodegenProject();
            project.createFfiSourceFile("gtk/button.ts");

            const files = project.getSourceFilesInNamespace("Gio");

            expect(files).toHaveLength(0);
        });

        it("matches files that start with namespace path", () => {
            const project = new CodegenProject();
            project.createSourceFile("gtk/button.ts");

            const files = project.getSourceFilesInNamespace("gtk");

            expect(files).toHaveLength(1);
        });
    });

    describe("emit", () => {
        it("returns map of file paths to content", async () => {
            const project = new CodegenProject();
            const sourceFile = project.createSourceFile("test.ts");
            sourceFile.addVariableStatement({
                declarations: [{ name: "x", initializer: "1" }],
            });

            const result = await project.emit();

            expect(result.size).toBe(1);
            expect(result.has("test.ts")).toBe(true);
            expect(result.get("test.ts")).toMatch(/(?:const|let)\s+x\s*=\s*1/);
        });

        it("removes leading slash from file paths", async () => {
            const project = new CodegenProject();
            project.createSourceFile("gtk/button.ts");

            const result = await project.emit();

            expect(result.has("gtk/button.ts")).toBe(true);
            expect(result.has("/gtk/button.ts")).toBe(false);
        });

        it("emits all source files", async () => {
            const project = new CodegenProject();
            project.createSourceFile("file1.ts");
            project.createSourceFile("file2.ts");

            const result = await project.emit();

            expect(result.size).toBe(2);
            expect(result.has("file1.ts")).toBe(true);
            expect(result.has("file2.ts")).toBe(true);
        });

        it("returns empty map for empty project", async () => {
            const project = new CodegenProject();

            const result = await project.emit();

            expect(result.size).toBe(0);
        });
    });

    describe("emitGrouped", () => {
        it("separates ffi and react files", async () => {
            const project = new CodegenProject();
            project.createFfiSourceFile("gtk/button.ts").addClass({ name: "Button" });
            project.createReactSourceFile("internal.ts").addVariableStatement({
                declarations: [{ name: "x", initializer: "1" }],
            });

            const { ffi, react } = await project.emitGrouped();

            expect(ffi.size).toBe(1);
            expect(react.size).toBe(1);
            expect(ffi.has("gtk/button.ts")).toBe(true);
            expect(react.has("internal.ts")).toBe(true);
        });

        it("removes ffi/ prefix from paths", async () => {
            const project = new CodegenProject();
            project.createFfiSourceFile("gtk/button.ts");

            const { ffi } = await project.emitGrouped();

            expect(ffi.has("gtk/button.ts")).toBe(true);
            expect(ffi.has("ffi/gtk/button.ts")).toBe(false);
        });

        it("removes react/ prefix from paths", async () => {
            const project = new CodegenProject();
            project.createReactSourceFile("internal.ts");

            const { react } = await project.emitGrouped();

            expect(react.has("internal.ts")).toBe(true);
            expect(react.has("react/internal.ts")).toBe(false);
        });

        it("ignores files not in ffi or react directories", async () => {
            const project = new CodegenProject();
            project.createSourceFile("other.ts");
            project.createFfiSourceFile("button.ts");
            project.createReactSourceFile("internal.ts");

            const { ffi, react } = await project.emitGrouped();

            expect(ffi.size).toBe(1);
            expect(react.size).toBe(1);
        });

        it("returns empty maps for empty project", async () => {
            const project = new CodegenProject();

            const { ffi, react } = await project.emitGrouped();

            expect(ffi.size).toBe(0);
            expect(react.size).toBe(0);
        });
    });

    describe("getProject", () => {
        it("returns the underlying ts-morph Project", () => {
            const codegenProject = new CodegenProject();
            const project = codegenProject.getProject();

            expect(project).toBeDefined();
            expect(typeof project.createSourceFile).toBe("function");
        });

        it("returns the same Project instance", () => {
            const codegenProject = new CodegenProject();
            const project1 = codegenProject.getProject();
            const project2 = codegenProject.getProject();

            expect(project1).toBe(project2);
        });

        it("allows direct ts-morph operations", () => {
            const codegenProject = new CodegenProject();
            const project = codegenProject.getProject();

            project.createSourceFile("direct.ts", "const x = 1;");

            expect(codegenProject.getSourceFile("direct.ts")).not.toBeNull();
        });
    });

    describe("file content manipulation", () => {
        it("supports adding classes to source files", () => {
            const project = new CodegenProject();
            const sourceFile = project.createSourceFile("button.ts");

            sourceFile.addClass({
                name: "Button",
                properties: [{ name: "label", type: "string" }],
            });

            expect(sourceFile.getClass("Button")).toBeDefined();
        });

        it("supports adding imports to source files", () => {
            const project = new CodegenProject();
            const sourceFile = project.createSourceFile("button.ts");

            sourceFile.addImportDeclaration({
                moduleSpecifier: "./base.js",
                namedImports: ["Widget"],
            });

            const imports = sourceFile.getImportDeclarations();
            expect(imports).toHaveLength(1);
        });

        it("supports adding functions to source files", () => {
            const project = new CodegenProject();
            const sourceFile = project.createSourceFile("utils.ts");

            sourceFile.addFunction({
                name: "helper",
                parameters: [{ name: "x", type: "number" }],
                returnType: "number",
                statements: "return x * 2;",
            });

            expect(sourceFile.getFunction("helper")).toBeDefined();
        });

        it("supports adding enums to source files", () => {
            const project = new CodegenProject();
            const sourceFile = project.createSourceFile("enums.ts");

            sourceFile.addEnum({
                name: "Orientation",
                members: [
                    { name: "HORIZONTAL", value: 0 },
                    { name: "VERTICAL", value: 1 },
                ],
            });

            expect(sourceFile.getEnum("Orientation")).toBeDefined();
        });

        it("supports adding interfaces to source files", () => {
            const project = new CodegenProject();
            const sourceFile = project.createSourceFile("types.ts");

            sourceFile.addInterface({
                name: "WidgetProps",
                properties: [{ name: "visible", type: "boolean" }],
            });

            expect(sourceFile.getInterface("WidgetProps")).toBeDefined();
        });

        it("supports adding type aliases to source files", () => {
            const project = new CodegenProject();
            const sourceFile = project.createSourceFile("types.ts");

            sourceFile.addTypeAlias({
                name: "Handler",
                type: "() => void",
            });

            expect(sourceFile.getTypeAlias("Handler")).toBeDefined();
        });
    });

    describe("integration scenarios", () => {
        it("supports FFI then React generation workflow", () => {
            const project = new CodegenProject();

            const ffiFile = project.createFfiSourceFile("gtk/button.ts");
            ffiFile.addClass({ name: "Button" });

            const reactFile = project.createReactSourceFile("jsx-types/gtk.ts");
            reactFile.addInterface({ name: "GtkButtonProps" });

            expect(project.getSourceFiles()).toHaveLength(2);
            expect(project.getSourceFile("ffi/gtk/button.ts")).not.toBeNull();
            expect(project.getSourceFile("react/jsx-types/gtk.ts")).not.toBeNull();
        });

        it("metadata is associated with correct source files", () => {
            const project = new CodegenProject();
            const buttonFile = project.createFfiSourceFile("gtk/button.ts");
            const widgetFile = project.createFfiSourceFile("gtk/widget.ts");

            project.metadata.setWidgetMeta(buttonFile, {
                className: "Button",
                jsxName: "GtkButton",
                namespace: "Gtk",
                propNames: ["label"],
                signalNames: ["clicked"],
                parentClassName: "Widget",
                parentNamespace: "Gtk",
                modulePath: "./gtk/button.js",
                constructorParams: [],
                properties: [],
                signals: [],
            });

            project.metadata.setWidgetMeta(widgetFile, {
                className: "Widget",
                jsxName: "GtkWidget",
                namespace: "Gtk",
                propNames: ["visible"],
                signalNames: [],
                parentClassName: null,
                parentNamespace: null,
                modulePath: "./gtk/widget.js",
                constructorParams: [],
                properties: [],
                signals: [],
            });

            expect(project.metadata.getWidgetMeta(buttonFile)?.className).toBe("Button");
            expect(project.metadata.getWidgetMeta(widgetFile)?.className).toBe("Widget");
        });
    });
});
