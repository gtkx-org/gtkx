import { StructureKind, VariableDeclarationKind, Writers } from "ts-morph";
import { describe, expect, it } from "vitest";
import {
    addNamespaceImports,
    buildFromPtrStatements,
    createConstExport,
    writeConstIdentifierArray,
    writeConstStringArray,
    writeObjectOrEmpty,
    writeStringArray,
    writeStringSet,
} from "../../../src/core/utils/structure-helpers.js";
import { createTestProject, createTestSourceFile } from "../../fixtures/ts-morph-helpers.js";

function executeWriterFunction(writerFn: ReturnType<typeof writeConstStringArray>): string {
    const project = createTestProject();
    const sourceFile = createTestSourceFile(project, "test.ts");
    sourceFile.addVariableStatement({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [{ name: "result", initializer: writerFn }],
    });
    const code = sourceFile.getFullText();
    const match = code.match(/const result = (.+);/s);
    return match?.[1]?.trim() ?? "";
}

describe("writeConstStringArray", () => {
    it("writes empty array", () => {
        const result = executeWriterFunction(writeConstStringArray([]));
        expect(result).toBe("[] as const");
    });

    it("writes single item array on single line", () => {
        const result = executeWriterFunction(writeConstStringArray(["hello"]));
        expect(result).toBe('["hello"] as const');
    });

    it("writes multiple items array on single line by default", () => {
        const result = executeWriterFunction(writeConstStringArray(["a", "b", "c"]));
        expect(result).toBe('["a", "b", "c"] as const');
    });

    it("quotes string values", () => {
        const result = executeWriterFunction(writeConstStringArray(["unquoted"]));
        expect(result).toContain('"unquoted"');
    });

    it("writes multi-line array when singleLine is false", () => {
        const result = executeWriterFunction(writeConstStringArray(["a", "b"], { singleLine: false }));
        expect(result).toContain("\n");
        expect(result).toContain('"a"');
        expect(result).toContain('"b"');
        expect(result).toContain("as const");
    });
});

describe("writeConstIdentifierArray", () => {
    it("writes empty array", () => {
        const result = executeWriterFunction(writeConstIdentifierArray([]));
        expect(result).toBe("[] as const");
    });

    it("writes identifiers without quotes", () => {
        const result = executeWriterFunction(writeConstIdentifierArray(["Gtk.Button", "Gtk.Label"]));
        expect(result).toBe("[Gtk.Button, Gtk.Label] as const");
    });

    it("writes single identifier", () => {
        const result = executeWriterFunction(writeConstIdentifierArray(["MyClass"]));
        expect(result).toBe("[MyClass] as const");
    });

    it("writes multi-line array when singleLine is false", () => {
        const result = executeWriterFunction(writeConstIdentifierArray(["Gtk.Button", "Gtk.Label"], { singleLine: false }));
        expect(result).toContain("\n");
        expect(result).toContain("Gtk.Button");
        expect(result).toContain("Gtk.Label");
        expect(result).toContain("as const");
    });
});

describe("writeStringArray", () => {
    it("writes empty array without as const", () => {
        const result = executeWriterFunction(writeStringArray([]));
        expect(result).toBe("[]");
        expect(result).not.toContain("as const");
    });

    it("writes string array without as const", () => {
        const result = executeWriterFunction(writeStringArray(["a", "b"]));
        expect(result).toBe('["a", "b"]');
        expect(result).not.toContain("as const");
    });

    it("writes multi-line array when singleLine is false", () => {
        const result = executeWriterFunction(writeStringArray(["a", "b"], { singleLine: false }));
        expect(result).toContain("\n");
        expect(result).toContain('"a"');
        expect(result).toContain('"b"');
        expect(result).not.toContain("as const");
    });
});

describe("writeStringSet", () => {
    it("writes empty Set", () => {
        const result = executeWriterFunction(writeStringSet([]));
        expect(result).toBe("new Set([])");
    });

    it("writes Set with items", () => {
        const result = executeWriterFunction(writeStringSet(["clicked", "pressed"]));
        expect(result).toBe('new Set(["clicked", "pressed"])');
    });

    it("wraps array in new Set()", () => {
        const result = executeWriterFunction(writeStringSet(["a"]));
        expect(result).toMatch(/^new Set\(/);
        expect(result).toMatch(/\)$/);
    });
});

describe("writeObjectOrEmpty", () => {
    it("writes empty object when properties is empty", () => {
        const result = executeWriterFunction(writeObjectOrEmpty({}, Writers));
        expect(result).toBe("{}");
    });

    it("writes object with properties", () => {
        const properties = {
            foo: (writer: { write: (s: string) => void }) => writer.write('"bar"'),
        };
        const result = executeWriterFunction(writeObjectOrEmpty(properties, Writers));
        expect(result).toContain("foo");
        expect(result).toContain("bar");
    });
});

describe("addNamespaceImports", () => {
    it("adds single namespace import", () => {
        const project = createTestProject();
        const sourceFile = createTestSourceFile(project, "test.ts");

        addNamespaceImports(sourceFile, ["Gtk"]);

        const imports = sourceFile.getImportDeclarations();
        expect(imports).toHaveLength(1);
        expect(imports[0].getModuleSpecifierValue()).toBe("@gtkx/ffi/gtk");
        expect(imports[0].getNamespaceImport()?.getText()).toBe("Gtk");
    });

    it("adds multiple namespace imports sorted alphabetically", () => {
        const project = createTestProject();
        const sourceFile = createTestSourceFile(project, "test.ts");

        addNamespaceImports(sourceFile, ["Gtk", "Adw", "Gio"]);

        const imports = sourceFile.getImportDeclarations();
        expect(imports).toHaveLength(3);
        const namespaces = imports.map((i) => i.getNamespaceImport()?.getText());
        expect(namespaces).toEqual(["Adw", "Gio", "Gtk"]);
    });

    it("accepts Set of namespaces", () => {
        const project = createTestProject();
        const sourceFile = createTestSourceFile(project, "test.ts");

        addNamespaceImports(sourceFile, new Set(["Gtk", "Adw"]));

        const imports = sourceFile.getImportDeclarations();
        expect(imports).toHaveLength(2);
    });

    it("lowercases namespace in module specifier", () => {
        const project = createTestProject();
        const sourceFile = createTestSourceFile(project, "test.ts");

        addNamespaceImports(sourceFile, ["GObject"]);

        const imports = sourceFile.getImportDeclarations();
        expect(imports[0].getModuleSpecifierValue()).toBe("@gtkx/ffi/gobject");
    });

    it("marks imports as type-only when option is set", () => {
        const project = createTestProject();
        const sourceFile = createTestSourceFile(project, "test.ts");

        addNamespaceImports(sourceFile, ["Gtk"], { isTypeOnly: true });

        const imports = sourceFile.getImportDeclarations();
        expect(imports[0].isTypeOnly()).toBe(true);
    });

    it("does not mark as type-only by default", () => {
        const project = createTestProject();
        const sourceFile = createTestSourceFile(project, "test.ts");

        addNamespaceImports(sourceFile, ["Gtk"]);

        const imports = sourceFile.getImportDeclarations();
        expect(imports[0].isTypeOnly()).toBe(false);
    });

    it("handles empty namespaces array", () => {
        const project = createTestProject();
        const sourceFile = createTestSourceFile(project, "test.ts");

        addNamespaceImports(sourceFile, []);

        const imports = sourceFile.getImportDeclarations();
        expect(imports).toHaveLength(0);
    });
});

describe("buildFromPtrStatements", () => {
    it("returns three statements", () => {
        const statements = buildFromPtrStatements("Button");
        expect(statements).toHaveLength(3);
    });

    it("includes Object.create with class prototype", () => {
        const statements = buildFromPtrStatements("Button");
        expect(statements[0]).toContain("Object.create(Button.prototype)");
    });

    it("includes type cast to class", () => {
        const statements = buildFromPtrStatements("Widget");
        expect(statements[0]).toContain("as Widget");
    });

    it("includes id assignment", () => {
        const statements = buildFromPtrStatements("Button");
        expect(statements[1]).toBe("instance.id = ptr;");
    });

    it("includes return statement", () => {
        const statements = buildFromPtrStatements("Button");
        expect(statements[2]).toBe("return instance;");
    });
});

describe("createConstExport", () => {
    it("creates exported const variable statement", () => {
        const result = createConstExport("MY_CONST", '"value"');

        expect(result.kind).toBe(StructureKind.VariableStatement);
        expect(result.isExported).toBe(true);
        expect(result.declarationKind).toBe(VariableDeclarationKind.Const);
    });

    it("sets variable name correctly", () => {
        const result = createConstExport("MY_CONST", '"value"');

        expect(result.declarations[0].name).toBe("MY_CONST");
    });

    it("sets string initializer", () => {
        const result = createConstExport("MY_CONST", '"hello"');

        expect(result.declarations[0].initializer).toBe('"hello"');
    });

    it("sets WriterFunction initializer", () => {
        const writerFn = writeConstStringArray(["a", "b"]);
        const result = createConstExport("MY_CONST", writerFn);

        expect(result.declarations[0].initializer).toBe(writerFn);
    });

    it("sets type annotation when provided", () => {
        const result = createConstExport("MY_CONST", '"value"', { type: "string" });

        expect(result.declarations[0].type).toBe("string");
    });

    it("sets docs from string", () => {
        const result = createConstExport("MY_CONST", '"value"', { docs: "My documentation" });

        expect(result.docs).toEqual([{ description: "My documentation" }]);
    });

    it("sets docs from array", () => {
        const docs = [{ description: "First doc" }, { description: "Second doc" }];
        const result = createConstExport("MY_CONST", '"value"', { docs });

        expect(result.docs).toEqual(docs);
    });

    it("has no docs when not provided", () => {
        const result = createConstExport("MY_CONST", '"value"');

        expect(result.docs).toBeUndefined();
    });

    it("has no type when not provided", () => {
        const result = createConstExport("MY_CONST", '"value"');

        expect(result.declarations[0].type).toBeUndefined();
    });
});
