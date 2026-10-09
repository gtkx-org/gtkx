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

    it("exposes only signal pointer slots whose ownership can be honored", async () => {
        using directory = createProject();
        const pointer = '<type name="gpointer" c:type="gpointer"/>';
        const shapes = [
            { name: "pointer-return", type: pointer, isReturn: true },
            {
                name: "array-parameter",
                type: `<array fixed-size="2" zero-terminated="0" c:type="gpointer*">${pointer}</array>`,
                isReturn: false,
            },
            {
                name: "list-parameter",
                type: `<array name="GLib.PtrArray" c:type="GPtrArray*">${pointer}</array>`,
                isReturn: false,
            },
        ];
        const signals = shapes.flatMap((shape) =>
            ["none", "container", "full"].map((transfer) => {
                const slot = shape.isReturn
                    ? `<return-value transfer-ownership="${transfer}">${shape.type}</return-value>`
                    : `<return-value transfer-ownership="none"><type name="none" c:type="void"/></return-value>
                       <parameters><parameter name="pointers" transfer-ownership="${transfer}">
                         ${shape.type}
                       </parameter></parameters>`;
                return `<glib:signal name="${transfer}-${shape.name}" when="last">${slot}</glib:signal>`;
            }),
        );
        writeFileSync(
            join(directory.path, "SignalOwnership-1.0.gir"),
            `<?xml version="1.0"?>
             <repository version="1.2" xmlns="http://www.gtk.org/introspection/core/1.0"
               xmlns:c="http://www.gtk.org/introspection/c/1.0" xmlns:glib="http://www.gtk.org/introspection/glib/1.0">
               <include name="GObject" version="2.0"/>
               <namespace name="SignalOwnership" version="1.0" shared-library="libsignalownership.so"
                 c:identifier-prefixes="SignalOwnership" c:symbol-prefixes="signal_ownership">
                 <class name="Emitter" c:type="SignalOwnershipEmitter" parent="GObject.Object"
                   glib:type-name="SignalOwnershipEmitter" glib:get-type="signal_ownership_emitter_get_type">
                   ${signals.join("\n")}
                 </class>
               </namespace>
             </repository>`,
        );
        const { gi } = resolveStore(directory.path);
        await runCodegen({ libraries: ["SignalOwnership-1.0"], girPath: resolveGirPath([directory.path]), gi });
        const consumer = 'import { Emitter } from "@gtkx/gi/signalownership"; declare const emitter: Emitter;';
        expect(
            diagnostics(
                directory.path,
                `${consumer}
                 emitter.connect("none-pointer-return", () => 1n);
                 export const pointer: bigint | null = emitter.emit("none-pointer-return");
                 ${[
                     "none-array-parameter",
                     "container-array-parameter",
                     "none-list-parameter",
                     "container-list-parameter",
                 ]
                     .map(
                         (signal) =>
                             `emitter.connect("${signal}", (pointers) => { const values: (bigint | null)[] = pointers; void values; });`,
                     )
                     .join("\n")}`,
            ),
        ).toEqual([]);
        for (const signal of [
            "container-pointer-return",
            "full-pointer-return",
            "full-array-parameter",
            "full-list-parameter",
        ]) {
            expect(diagnostics(directory.path, `${consumer} emitter.connect("${signal}", () => 1n);`)).toEqual(
                expect.arrayContaining([expect.stringContaining(signal)]),
            );
        }
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
