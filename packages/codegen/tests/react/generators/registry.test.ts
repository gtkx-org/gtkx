import { describe, expect, it } from "vitest";
import { CodegenProject } from "../../../src/core/project.js";
import { RegistryGenerator } from "../../../src/react/generators/registry.js";

function createTestSetup(namespaceNames: string[] = ["Gtk"]) {
    const project = new CodegenProject();
    const generator = new RegistryGenerator(project, namespaceNames);
    return { project, generator };
}

describe("RegistryGenerator", () => {
    describe("constructor", () => {
        it("creates generator with project and namespace names", () => {
            const { generator } = createTestSetup();
            expect(generator).toBeInstanceOf(RegistryGenerator);
        });
    });

    describe("generate", () => {
        it("creates registry.ts file in react directory", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            expect(sourceFile).not.toBeNull();
        });

        it("adds file comment", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("Generated namespace registry");
        });

        it("adds Namespace type alias", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            const typeAlias = sourceFile?.getTypeAlias("Namespace");
            expect(typeAlias).toBeDefined();
            expect(typeAlias?.getTypeNode()?.getText()).toBe("Record<string, unknown>");
        });

        it("adds NAMESPACE_REGISTRY constant", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("NAMESPACE_REGISTRY");
        });

        it("exports NAMESPACE_REGISTRY", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("export const NAMESPACE_REGISTRY");
        });

        it("types NAMESPACE_REGISTRY as [string, Namespace][]", () => {
            const { project, generator } = createTestSetup();

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("[string, Namespace][]");
        });

        it("includes namespace import for single namespace", () => {
            const { project, generator } = createTestSetup(["Gtk"]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            const imports = sourceFile?.getImportDeclarations() ?? [];
            const gtkImport = imports.find((i) => i.getNamespaceImport()?.getText() === "Gtk");
            expect(gtkImport).toBeDefined();
        });

        it("includes namespace imports for multiple namespaces", () => {
            const { project, generator } = createTestSetup(["Gtk", "Gdk", "Gio"]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            const imports = sourceFile?.getImportDeclarations() ?? [];
            const namespaces = imports.map((i) => i.getNamespaceImport()?.getText()).filter(Boolean);
            expect(namespaces).toContain("Gtk");
            expect(namespaces).toContain("Gdk");
            expect(namespaces).toContain("Gio");
        });

        it("includes namespace entries in registry array", () => {
            const { project, generator } = createTestSetup(["Gtk"]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain('["Gtk", Gtk]');
        });

        it("includes all namespace entries in registry array", () => {
            const { project, generator } = createTestSetup(["Gtk", "Adw", "Gio"]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain('["Gtk", Gtk]');
            expect(code).toContain('["Adw", Adw]');
            expect(code).toContain('["Gio", Gio]');
        });

        it("sorts namespaces by length descending then alphabetically", () => {
            const { project, generator } = createTestSetup(["Gtk", "GObject", "Gio"]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            const code = sourceFile?.getFullText() ?? "";

            const gobjectIndex = code.indexOf('["GObject"');
            const gtkIndex = code.indexOf('["Gtk"');
            const gioIndex = code.indexOf('["Gio"');

            expect(gobjectIndex).toBeLessThan(gioIndex);
            expect(gioIndex).toBeLessThan(gtkIndex);
        });

        it("handles empty namespace list", () => {
            const { project, generator } = createTestSetup([]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain("NAMESPACE_REGISTRY");
            expect(code).toContain("[]");
        });

        it("handles single namespace", () => {
            const { project, generator } = createTestSetup(["Adw"]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            const code = sourceFile?.getFullText() ?? "";
            expect(code).toContain('["Adw", Adw]');
        });
    });

    describe("namespace import paths", () => {
        it("imports namespaces from generated FFI modules", () => {
            const { project, generator } = createTestSetup(["Gtk"]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            const imports = sourceFile?.getImportDeclarations() ?? [];
            const gtkImport = imports.find((i) => i.getNamespaceImport()?.getText() === "Gtk");
            const moduleSpecifier = gtkImport?.getModuleSpecifierValue();
            expect(moduleSpecifier).toContain("gtk");
        });
    });

    describe("integration", () => {
        it("generates valid TypeScript structure", () => {
            const { project, generator } = createTestSetup(["Gtk", "Gdk", "Gio", "GObject", "Pango"]);

            generator.generate();

            const sourceFile = project.getSourceFile("react/registry.ts");
            expect(sourceFile?.getStatements().length).toBeGreaterThan(0);
            expect(sourceFile?.getTypeAliases()).toHaveLength(1);
            expect(sourceFile?.getVariableStatements()).toHaveLength(1);
        });
    });
});
