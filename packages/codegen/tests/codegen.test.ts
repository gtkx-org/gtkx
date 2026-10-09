import { mkdtempDisposableSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
    loadApiReference,
    readGeneratedElements,
    readGeneratedLibraries,
    resolveGirPath,
    resolveStore,
    runCodegen,
} from "../src/index.js";

const workspace = fileURLToPath(new URL("../../..", import.meta.url));
const createProject = () => {
    const directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-codegen-test-"));
    const modules = join(directory.path, "node_modules");
    mkdirSync(join(modules, "@gtkx"), { recursive: true });
    for (const name of ["runtime", "cairo", "react"]) {
        symlinkSync(join(workspace, "packages", name), join(modules, "@gtkx", name), "dir");
    }
    for (const name of ["@types", "react", "csstype"]) {
        symlinkSync(join(workspace, "node_modules", name), join(modules, name), "dir");
    }
    writeFileSync(
        join(directory.path, "package.json"),
        '{"name":"codegen-consumer","version":"1.0.0","type":"module"}',
    );
    return directory;
};

const diagnostics = (root: string, source: string) => {
    const file = join(root, "consumer.ts");
    writeFileSync(file, source);
    const program = ts.createProgram([file], {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
    });
    return ts
        .getPreEmitDiagnostics(program)
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
};

describe("generated bindings", () => {
    it("generates upstream GIR declarations, checks consumers and reuses fresh output", async () => {
        using directory = createProject();
        const { gi } = resolveStore(directory.path);
        const options = { libraries: ["Gio-2.0"], girPath: resolveGirPath(undefined, directory.path), gi };
        expect(await runCodegen(options)).toMatchObject({ isRegenerated: true });
        expect(readGeneratedLibraries(gi.storeDir)).toBeDefined();
        expect(
            diagnostics(
                directory.path,
                `import { File } from "@gtkx/gi/gio";
            const file: File = File.newForPath("/tmp/example");
            const path: string | null = file.getPath();
            export { path };`,
            ),
        ).toEqual([]);
        expect(
            diagnostics(
                directory.path,
                `import { File } from "@gtkx/gi/gio";
            const file: number = File.newForPath("/tmp/example"); export { file };`,
            ),
        ).not.toEqual([]);
        expect(await runCodegen(options)).toMatchObject({ isRegenerated: false });
        expect(await runCodegen({ ...options, isForced: true })).toMatchObject({ isRegenerated: true });
        expect(readFileSync(join(gi.linkDir, "package.json"), "utf8")).toContain("@gtkx/gi");
    });

    it("generates JSX bindings that accept documented props and reject incompatible consumers", async () => {
        using directory = createProject();
        const { gi, jsx } = resolveStore(directory.path);
        if (jsx === null) throw new Error("JSX store was not resolved");
        await runCodegen({ libraries: ["Adw-1"], girPath: resolveGirPath(undefined, directory.path), gi, jsx });
        expect(readGeneratedElements(jsx.storeDir)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ glibName: "GtkButton", isMountable: true }),
                expect.objectContaining({ glibName: "AdwApplicationWindow", isMountable: true }),
            ]),
        );
        const imports = 'import { createElement } from "react"; import { GtkButton } from "@gtkx/jsx/gtk";';
        expect(
            diagnostics(
                directory.path,
                `${imports} export const button = createElement(GtkButton, { label: "Hello" });`,
            ),
        ).toEqual([]);
        expect(
            diagnostics(directory.path, `${imports} export const button = createElement(GtkButton, { label: 42 });`),
        ).not.toEqual([]);
    });

    it("indexes upstream class, function and documentation contracts", () => {
        const reference = loadApiReference({
            libraries: ["Gio-2.0"],
            girPath: resolveGirPath(undefined, workspace),
            resolveFrom: workspace,
        });
        expect(reference.lookup("Gio.File", "interface")).toMatchObject({ outcome: "page", symbol: { name: "File" } });
        expect(reference.lookup("Gio.DoesNotExist")).toMatchObject({ outcome: "notFound" });
        expect(reference.symbols({ namespace: "Gio", kinds: ["class"] })).toEqual(
            expect.arrayContaining([expect.objectContaining({ name: "Application" })]),
        );
    });

    it("rejects missing and malformed metadata without publishing a store", async () => {
        using directory = createProject();
        const { gi } = resolveStore(directory.path);
        await expect(runCodegen({ libraries: ["Missing-1.0"], girPath: [directory.path], gi })).rejects.toThrow();
        const metadata = join(directory.path, "Broken-1.0.gir");
        mkdirSync(dirname(metadata), { recursive: true });
        writeFileSync(metadata, "<repository><namespace>");
        await expect(runCodegen({ libraries: ["Broken-1.0"], girPath: [directory.path], gi })).rejects.toThrow();
    });
});
