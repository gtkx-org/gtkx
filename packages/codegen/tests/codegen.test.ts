import { execFileSync } from "node:child_process";
import {
    closeSync,
    constants,
    cpSync,
    existsSync,
    mkdtempDisposableSync,
    mkdirSync,
    openSync,
    readFileSync,
    realpathSync,
    renameSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
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
import { readBuiltinElementsForDocs, writeDocs } from "../src/internal.js";

const workspace = fileURLToPath(new URL("../../..", import.meta.url));
const createProject = () => {
    const directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-codegen-test-"));
    const modules = join(directory.path, "node_modules");
    mkdirSync(join(modules, "@gtkx"), { recursive: true });
    for (const name of ["runtime", "cairo", "react", "native"]) {
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
    it("generates MatchInfo consumers through regex methods and callbacks", async () => {
        using directory = createProject();
        const { gi } = resolveStore(directory.path);
        await runCodegen({ libraries: ["GLib-2.0"], girPath: resolveGirPath(undefined, directory.path), gi });

        expect(
            diagnostics(
                directory.path,
                `import { type MatchInfo, type Regex, RegexMatchFlags } from "@gtkx/gi/glib";
                declare const regex: Regex;
                const [matched, info]: [boolean, MatchInfo] = regex.match("hello", RegexMatchFlags.DEFAULT);
                export const fetched: string | null = info.fetch(0);
                export const replaced: string = regex.replaceEval(
                    "hello", 0, RegexMatchFlags.DEFAULT,
                    (match: MatchInfo, result) => {
                        result.append(match.fetch(0) ?? "");
                        return false;
                    },
                );
                export { matched };`,
            ),
        ).toEqual([]);
    });

    it("omits closure and parameter reference sinking from generated consumers", async () => {
        using directory = createProject();
        const { gi } = resolveStore(directory.path);
        await runCodegen({ libraries: ["GObject-2.0"], girPath: resolveGirPath(undefined, directory.path), gi });

        expect(
            diagnostics(
                directory.path,
                `import { Closure, ParamSpec } from "@gtkx/gi/gobject";
                declare const closure: Closure;
                declare const spec: ParamSpec;
                closure.sink();
                spec.sink();`,
            ),
        ).toEqual([
            expect.stringContaining("Property 'sink' does not exist on type 'Closure'"),
            expect.stringContaining("Property 'sink' does not exist on type 'ParamSpec'"),
        ]);
    });

    it("honors the requested store lock timeout and generates after the lock is released", async () => {
        using directory = createProject();
        const { gi } = resolveStore(directory.path);
        const storeRoot = dirname(gi.storeDir);
        mkdirSync(storeRoot, { recursive: true });
        const lockFd = openSync(storeRoot, constants.O_RDONLY | constants.O_DIRECTORY);
        const options = {
            libraries: ["Gio-2.0"],
            girPath: resolveGirPath(undefined, directory.path),
            gi,
            lockTimeoutMs: 25,
        };

        try {
            execFileSync("flock", ["--exclusive", "3"], { stdio: ["ignore", "ignore", "ignore", lockFd] });
            await expect(runCodegen(options)).rejects.toThrow("raise the 25ms limit");
        } finally {
            closeSync(lockFd);
        }

        expect(await runCodegen(options)).toMatchObject({ isRegenerated: true });
        expect(readGeneratedLibraries(gi.storeDir)).toBeDefined();
    });

    it("generates upstream GIR declarations, checks consumers and reuses fresh output", async () => {
        using directory = createProject();
        const { gi } = resolveStore(directory.path);
        const options = { libraries: ["Gio-2.0"], girPath: resolveGirPath(undefined, directory.path), gi };
        expect(await runCodegen(options)).toMatchObject({ isRegenerated: true });
        expect(readGeneratedLibraries(gi.storeDir)).toBeDefined();
        expect(
            diagnostics(
                directory.path,
                `import {
                Application,
                Cancellable,
                File,
                ListModel,
                type ListModelImpl,
                type Socket,
                type SocketAddress,
            } from "@gtkx/gi/gio";
            import { Object as GObject, TYPE_INT, TYPE_OBJECT } from "@gtkx/gi/gobject";
            import { registerClass } from "@gtkx/runtime";
            const file: File = File.newForPath("/tmp/example");
            const path: string | null = file.getPath();
            const cancellable: GObject = new Cancellable();
            declare const someObject: GObject;
            declare const address: SocketAddress;
            const socket = someObject as Socket;
            const connected: boolean = socket.connect(address, null);
            // @ts-expect-error a socket connects to an address
            socket.connect("localhost");
            class StoreBase extends GObject implements ListModelImpl {
                vfuncGetItemType(): bigint { return TYPE_OBJECT; }
                vfuncGetNItems(): number { return 0; }
                vfuncGetItem(): GObject | null { return null; }
            }
            const Store = registerClass(StoreBase, { typeName: "ConsumerStore", implements: [ListModel] });
            const model: ListModel = new Store();
            model.connect("items-changed", (position: number, removed: number, added: number) => position + removed + added);
            class ServiceBase extends Application {
                declare count: number;
                pulse(): boolean {
                    this.emit("activate");
                    this.emit("action-enabled-changed", "quit", true);
                    this.emit("action-added::quit", "quit");
                    const id: bigint = this.connect("shutdown", () => {});
                    this.disconnect(id);
                    const onStartup = (): void => {};
                    this.on("startup", onStartup).once("activate", () => {}).off("startup", onStartup);
                    this.connect("action-enabled-changed", (name, enabled) => name.length > 0 && enabled);
                    this.connect("notify::application-id", (pspec) => pspec.getName());
                    this.connect("notify::count", (pspec) => pspec.getName());
                    // @ts-expect-error unknown signal
                    this.emit("no-such-signal");
                    // @ts-expect-error activate takes no arguments
                    this.emit("activate", 1);
                    // @ts-expect-error enabled is a boolean
                    this.emit("action-enabled-changed", "quit", "yes");
                    // @ts-expect-error activate has no details
                    this.connect("activate::detail", () => {});
                    // @ts-expect-error the action name is a string
                    this.connect("action-added", (name: number) => name);
                    // @ts-expect-error unknown signal
                    this.on("no-such-signal", () => {});
                    return this.emit("name-lost");
                }
            }
            const Service = registerClass(ServiceBase, {
                typeName: "ConsumerService",
                signals: { bumped: { paramTypes: [TYPE_INT] } },
            });
            class CounterBase extends Service {
                bump(): void {
                    this.connect("bumped", () => {});
                    this.emit("bumped", 1);
                    // @ts-expect-error unknown signal
                    this.emit("bumpd", 1);
                }
            }
            export const Counter = registerClass(CounterBase, { typeName: "ConsumerCounter" });
            new Counter().emit("bumped", 2);
            declare const either: Application | ServiceBase;
            either.emit("activate");
            either.on("startup", () => {}).disconnect(either.connect("shutdown", () => {}));
            export { cancellable, connected, path };`,
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
        writeFileSync(join(gi.storeDir, ".codegen-fingerprint.json"), "null");
        expect(await runCodegen(options)).toMatchObject({ isRegenerated: true });
        const legacyStore = join(directory.path, "legacy-gi");
        cpSync(realpathSync(gi.storeDir), legacyStore, { recursive: true });
        rmSync(gi.storeDir);
        renameSync(legacyStore, gi.storeDir);
        expect(await runCodegen(options)).toMatchObject({ isRegenerated: true });
        expect(await runCodegen({ ...options, isForced: true })).toMatchObject({ isRegenerated: true });
        expect(readFileSync(join(gi.linkDir, "package.json"), "utf8")).toContain("@gtkx/gi");
    });

    it("adds and removes JSX while preserving published bindings through failed generation", async () => {
        using directory = createProject();
        const { gi, jsx } = resolveStore(directory.path);
        if (jsx === null) throw new Error("JSX store was not resolved");
        const options = { libraries: ["Gio-2.0"], girPath: resolveGirPath(undefined, directory.path), gi };
        await runCodegen(options);
        expect(existsSync(jsx.linkDir)).toBe(false);
        await runCodegen({ ...options, jsx });
        const previousJsx = realpathSync(join(jsx.linkDir, "gio", "index.d.ts"));
        expect(readGeneratedElements(jsx.linkDir).length).toBeGreaterThan(0);

        await expect(runCodegen({ ...options, libraries: ["Missing-1.0"], jsx })).rejects.toThrow();
        expect(realpathSync(join(jsx.linkDir, "gio", "index.d.ts"))).toBe(previousJsx);
        writeFileSync(join(jsx.storeDir, ".codegen-fingerprint.json"), "{}");
        expect(await runCodegen({ ...options, jsx })).toMatchObject({ isRegenerated: true });

        await runCodegen({ ...options, libraries: ["GLib-2.0"] });
        expect(existsSync(jsx.linkDir)).toBe(false);
        expect(readGeneratedLibraries(gi.linkDir)?.libraries).toEqual(["GLib-2.0"]);
        const previousGi = dirname(createRequire(previousJsx).resolve("@gtkx/gi/package.json"));
        expect(readGeneratedLibraries(previousGi)?.libraries).toContain("Gio-2.0");

        await runCodegen({ ...options, jsx });
        expect(readGeneratedElements(jsx.linkDir).length).toBeGreaterThan(0);
        expect(await runCodegen({ ...options, jsx })).toMatchObject({ isRegenerated: false });
    });

    it("shares matching bindings and rejects incompatible changes from another project", async () => {
        using directory = createProject();
        const { gi, jsx } = resolveStore(directory.path);
        if (jsx === null) throw new Error("JSX store was not resolved");
        const options = { libraries: ["Gio-2.0"], girPath: resolveGirPath(undefined, directory.path), gi, jsx };
        await runCodegen(options);
        const consumer = join(directory.path, "consumer");
        mkdirSync(consumer);
        const shared = resolveStore(consumer);
        if (shared.jsx === null) throw new Error("Shared JSX store was not resolved");
        const sharedOptions = { ...options, gi: shared.gi, jsx: shared.jsx, isForced: true };
        await runCodegen(sharedOptions);
        await expect(runCodegen({ ...sharedOptions, libraries: ["GLib-2.0"] })).rejects.toThrow();
        await expect(runCodegen({ ...sharedOptions, jsx: undefined })).rejects.toThrow();
        expect(readGeneratedLibraries(gi.linkDir)?.libraries).toContain("Gio-2.0");
        expect(readGeneratedElements(jsx.linkDir).length).toBeGreaterThan(0);

        const customStore = (name: string) => ({
            ...gi,
            storeDir: join(dirname(gi.storeDir), name),
            linkDir: join(directory.path, name, "node_modules", "@gtkx", "gi"),
        });
        const first = customStore("first");
        const second = customStore("second");
        const unrelated = join(dirname(first.linkDir), "jsx", "sentinel.txt");
        mkdirSync(dirname(unrelated), { recursive: true });
        writeFileSync(unrelated, "preserve");
        await runCodegen({ ...options, gi: first, jsx: undefined, libraries: ["GLib-2.0"] });
        await runCodegen({ ...options, gi: second, jsx: undefined, libraries: ["GObject-2.0"] });
        expect(readGeneratedLibraries(first.linkDir)?.libraries).toEqual(["GLib-2.0"]);
        expect(readGeneratedLibraries(second.linkDir)?.libraries).toContain("GObject-2.0");
        expect(readGeneratedLibraries(gi.linkDir)?.libraries).toContain("Gio-2.0");
        expect(readGeneratedElements(jsx.linkDir).length).toBeGreaterThan(0);
        expect(readFileSync(unrelated, "utf8")).toBe("preserve");

        const nestedCairo = join(directory.path, "nested-cairo");
        mkdirSync(join(nestedCairo, "node_modules", "@gtkx"), { recursive: true });
        rmSync(join(directory.path, "node_modules", "@gtkx", "cairo"));
        symlinkSync(join(workspace, "packages", "cairo"), join(nestedCairo, "node_modules", "@gtkx", "cairo"), "dir");
        expect(() => resolveStore(nestedCairo)).toThrow();
    });

    it("refreshes reference pages when their props dependencies or cached metadata change", () => {
        using directory = createProject();
        const props = join(directory.path, "props.ts");
        const base = join(directory.path, "base.ts");
        writeFileSync(props, 'export type { CustomProps } from "./base.js";');
        writeFileSync(base, "export interface CustomProps { caption: string }");
        const options = {
            libraries: ["Gtk-4.0"],
            girPath: resolveGirPath(undefined, directory.path),
            resolveFrom: directory.path,
            outDir: join(directory.path, "reference"),
            props: { GtkButton: { module: "./props.js", export: "CustomProps" } },
        };
        expect(writeDocs(options).isRegenerated).toBe(true);
        expect(writeDocs(options).isRegenerated).toBe(false);
        writeFileSync(base, "export interface CustomProps { replacement: string }");
        expect(writeDocs(options).isRegenerated).toBe(true);
        expect(readFileSync(join(options.outDir, "gtk", "button.md"), "utf8")).toContain("### `replacement`");
        writeFileSync(join(options.outDir, ".codegen-fingerprint.json"), "{}");
        expect(writeDocs(options).isRegenerated).toBe(true);
        expect(writeDocs(options).isRegenerated).toBe(false);
    });

    it("documents the children slot of parent-created elements in place of their construct-only props", async () => {
        using directory = createProject();
        const outDir = join(directory.path, "reference");
        writeDocs({
            ...(await readBuiltinElementsForDocs()),
            libraries: ["Adw-1"],
            girPath: resolveGirPath(undefined, directory.path),
            resolveFrom: directory.path,
            outDir,
        });
        const page = (name: string) => readFileSync(join(outDir, "adw", `${name}.md`), "utf8");
        expect(page("layout")).toContain("### `children`");
        expect(page("layout")).not.toContain("### `content`");
        expect(page("view-stack-page")).toContain("### `children`");
        expect(page("view-stack-page")).not.toContain("### `child`\n");
        expect(page("layout-slot")).toContain("### `id`");
        expect(page("layout-slot")).not.toContain("### `children`");
    });

    it("renders GIR enumeration member links with the emitted member names", async () => {
        using directory = createProject();
        const outDir = join(directory.path, "reference");
        writeDocs({
            ...(await readBuiltinElementsForDocs()),
            libraries: ["Adw-1"],
            girPath: resolveGirPath(undefined, directory.path),
            resolveFrom: directory.path,
            outDir,
        });
        const toastOverlay = readFileSync(join(outDir, "adw", "toast-overlay.md"), "utf8");
        expect(toastOverlay).toContain("uses the `Gtk.AccessibleRole.GROUP` role");
        expect(toastOverlay).not.toContain("`Gtk.AccessibleRole.group`");
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
        expect(
            diagnostics(
                directory.path,
                `import { createElement } from "react"; import { GtkStack } from "@gtkx/jsx/gtk";
                export const stack = createElement(GtkStack, {
                    onNotifyVisibleChild: (child) => child?.getName(),
                    onNotifyHhomogeneous: (isHomogeneous: boolean) => !isHomogeneous,
                    onNotifyTransitionDuration: (duration: number) => duration.toFixed(),
                });`,
            ),
        ).toEqual([]);
        execFileSync(
            process.execPath,
            [
                "--input-type=module",
                "-e",
                `import assert from "node:assert/strict";
                import { createRequire } from "node:module";
                import { File } from "@gtkx/gi/gio";
                import { init } from "@gtkx/native";
                assert.equal(File.newForPath("/tmp/example").getPath(), "/tmp/example");
                assert.equal(typeof init, "function");
                const require = createRequire(import.meta.url);
                for (const name of ["@gtkx/gi/gio", "@gtkx/jsx/gtk", "@gtkx/native"]) {
                    import.meta.resolve(name);
                    assert.throws(() => require(name), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
                }`,
            ],
            { cwd: directory.path, stdio: "pipe", timeout: 20_000 },
        );
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

    it("passes the receiver to methods of GIR regenerated from a typelib", async () => {
        using directory = createProject();
        writeFileSync(
            join(directory.path, "Regenerated-1.0.gir"),
            `<?xml version="1.0"?>
             <repository version="1.0" xmlns="http://www.gtk.org/introspection/core/1.0"
               xmlns:c="http://www.gtk.org/introspection/c/1.0" xmlns:glib="http://www.gtk.org/introspection/glib/1.0">
               <include name="GObject" version="2.0"/>
               <namespace name="Regenerated" version="1.0" shared-library="libgio-2.0.so.0" c:prefix="G">
                 <class name="Cancellable" parent="GObject.Object" glib:type-name="GCancellable"
                   glib:get-type="g_cancellable_get_type">
                   <constructor name="new" c:identifier="g_cancellable_new">
                     <return-value transfer-ownership="full"><type name="Cancellable"/></return-value>
                   </constructor>
                   <method name="cancel" c:identifier="g_cancellable_cancel">
                     <return-value transfer-ownership="none"><type name="none"/></return-value>
                   </method>
                   <method name="is_cancelled" c:identifier="g_cancellable_is_cancelled">
                     <return-value transfer-ownership="none"><type name="gboolean"/></return-value>
                   </method>
                 </class>
               </namespace>
             </repository>`,
        );
        const { gi } = resolveStore(directory.path);
        await runCodegen({ libraries: ["Regenerated-1.0"], girPath: resolveGirPath([directory.path]), gi });
        const cancelled = execFileSync(
            process.execPath,
            [
                "--input-type=module",
                "-e",
                `import { Cancellable } from "@gtkx/gi/regenerated";
                const first = Cancellable.new();
                const second = Cancellable.new();
                second.cancel();
                console.log(JSON.stringify([first.isCancelled(), second.isCancelled()]));`,
            ],
            { cwd: directory.path, encoding: "utf8", stdio: "pipe", timeout: 20_000 },
        );
        expect(JSON.parse(cancelled)).toEqual([false, true]);
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
