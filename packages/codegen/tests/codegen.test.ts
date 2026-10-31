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
                DBusError,
                dbusErrorGetRemoteError,
                File,
                ListModel,
                type ListModelImpl,
                type Socket,
                type SocketAddress,
            } from "@gtkx/gi/gio";
            import { Error as GLibError, Source, sourceRemove, UnicodeScript } from "@gtkx/gi/glib";
            import { Object as GObject, TYPE_INT, TYPE_OBJECT } from "@gtkx/gi/gobject";
            import { registerClass, withSignals } from "@gtkx/runtime";
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
            declare const gerror: GLibError;
            const remote: string | null = DBusError.getRemoteError(gerror);
            const isFailed: boolean = gerror.matches(DBusError, DBusError.FAILED);
            const created: GLibError = new GLibError(DBusError, DBusError.FAILED, "failed");
            const flat: string | null = dbusErrorGetRemoteError(gerror);
            const domain: number = DBusError.quark();
            const failed: DBusError = DBusError.FAILED;
            const script: UnicodeScript = UnicodeScript.fromIso15924(0x4c61746e);
            const latin: UnicodeScript.LATIN = UnicodeScript.LATIN;
            const tag: number = UnicodeScript.toIso15924(latin);
            const latinName: string | undefined = UnicodeScript[latin];
            const removed: boolean = Source.remove(1);
            const removedFlat: boolean = sourceRemove(1);
            class TickerBase extends withSignals(Application, { ticked: { paramTypes: [TYPE_INT] } }) {
                tick(): void {
                    this.emit("ticked", 1);
                    queueMicrotask(() => this.emit("ticked", 2));
                    this.connect("ticked", () => {});
                    this.on("ticked", () => {});
                    this.emit("activate");
                    // @ts-expect-error unknown signal
                    this.emit("tickd", 1);
                }
            }
            export const Ticker = registerClass(TickerBase, {
                typeName: "ConsumerTicker",
                signals: { reset: {} },
            });
            const ticker = new Ticker();
            ticker.on("ticked", () => {});
            ticker.emit("reset");
            declare const either: Application | ServiceBase;
            either.emit("activate");
            either.on("startup", () => {}).disconnect(either.connect("shutdown", () => {}));
            export { cancellable, connected, created, domain, failed, flat, isFailed, latinName, path, remote, removed, removedFlat, script, tag };`,
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

    it("shares bindings for the union of projects' libraries and rejects incompatible projects", async () => {
        using directory = createProject();
        const { gi, jsx } = resolveStore(directory.path);
        if (jsx === null) throw new Error("JSX store was not resolved");
        const girPath = resolveGirPath(undefined, directory.path);
        const options = { libraries: ["Gio-2.0"], girPath, gi, jsx };
        await runCodegen(options);
        const consumer = join(directory.path, "consumer");
        mkdirSync(consumer);
        const shared = resolveStore(consumer);
        if (shared.jsx === null) throw new Error("Shared JSX store was not resolved");
        const sharedOptions = { ...options, gi: shared.gi, jsx: shared.jsx };
        await runCodegen({ ...sharedOptions, libraries: ["GLib-2.0"] });
        expect(readGeneratedLibraries(gi.linkDir)?.libraries).toEqual(["Gio-2.0", "GLib-2.0"]);
        expect(await runCodegen(options)).toMatchObject({ isRegenerated: false });
        await expect(runCodegen({ ...sharedOptions, jsx: undefined })).rejects.toThrow();
        await expect(runCodegen({ ...sharedOptions, userLazyElements: ["GtkLabel"] })).rejects.toThrow();
        await expect(runCodegen({ ...sharedOptions, girPath: [consumer, ...girPath] })).rejects.toThrow();
        await expect(runCodegen({ ...sharedOptions, libraries: ["Gio-3.0"] })).rejects.toThrow();
        expect(readGeneratedElements(jsx.linkDir).length).toBeGreaterThan(0);
        await runCodegen({ ...sharedOptions, jsx: { ...shared.jsx, version: "0.0.0" } });
        await runCodegen(options);
        await runCodegen({ ...sharedOptions, userLazyElements: ["GtkLabel"], isSharingForced: true });
        await expect(runCodegen(options)).rejects.toThrow();
        await runCodegen({ ...options, isSharingForced: true });
        expect(readGeneratedLibraries(gi.linkDir)?.libraries).toEqual(["Gio-2.0"]);
        await runCodegen({ ...sharedOptions, libraries: ["GLib-2.0"] });

        const otherReact = join(consumer, "node_modules", "react");
        mkdirSync(otherReact, { recursive: true });
        writeFileSync(join(otherReact, "package.json"), '{"name":"react","version":"19.0.0"}');
        expect(() => resolveStore(consumer)).toThrow();
        rmSync(consumer, { recursive: true });
        await runCodegen(options);
        expect(readGeneratedLibraries(gi.linkDir)?.libraries).toEqual(["Gio-2.0"]);

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
        const nested = resolveStore(nestedCairo);
        await runCodegen({ ...options, gi: nested.gi, jsx: nested.jsx ?? undefined });
        expect(createRequire(realpathSync(join(gi.linkDir, "package.json"))).resolve("@gtkx/cairo/package.json")).toBe(
            realpathSync(join(workspace, "packages", "cairo", "package.json")),
        );
    });

    it("limits each project sharing a store to the namespaces of its own libraries", async () => {
        using directory = createProject();
        const girPath = resolveGirPath(undefined, directory.path);
        const root = resolveStore(directory.path);
        if (root.jsx === null) throw new Error("JSX store was not resolved");
        await runCodegen({ libraries: ["Gio-2.0"], girPath, gi: root.gi, jsx: root.jsx });
        const app = join(directory.path, "apps", "app");
        mkdirSync(app, { recursive: true });
        const shared = resolveStore(app);
        if (shared.jsx === null) throw new Error("Shared JSX store was not resolved");
        await runCodegen({ libraries: ["GObject-2.0"], girPath, gi: shared.gi, jsx: shared.jsx });
        const resolveFrom = (cwd: string, specifier: string) =>
            realpathSync(
                fileURLToPath(
                    execFileSync(
                        process.execPath,
                        ["--input-type=module", "-e", `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`],
                        { cwd, encoding: "utf8", stdio: "pipe" },
                    ).trim(),
                ),
            );

        expect(resolveFrom(app, "@gtkx/gi/gobject")).toBe(resolveFrom(directory.path, "@gtkx/gi/gobject"));
        expect(resolveFrom(app, "@gtkx/gi/glib")).toBe(resolveFrom(directory.path, "@gtkx/gi/glib"));
        expect(resolveFrom(app, "@gtkx/jsx/gobject")).toBe(resolveFrom(directory.path, "@gtkx/jsx/gobject"));
        expect(() => resolveFrom(app, "@gtkx/gi/gio")).toThrow();
        expect(() => resolveFrom(app, "@gtkx/jsx/gio")).toThrow();
        expect(resolveFrom(directory.path, "@gtkx/gi/gio")).toBe(
            realpathSync(join(root.gi.linkDir, "gio", "index.js")),
        );
        expect(
            diagnostics(
                app,
                `import { typeFromName } from "@gtkx/gi/gobject";
                export const type: bigint = typeFromName("GObject");`,
            ),
        ).toEqual([]);
        expect(
            diagnostics(app, `import { File } from "@gtkx/gi/gio"; export const file = File.newForPath("/tmp");`),
        ).not.toEqual([]);
        expect(
            diagnostics(
                directory.path,
                `import { File } from "@gtkx/gi/gio"; export const file: File = File.newForPath("/tmp");`,
            ),
        ).toEqual([]);

        await runCodegen({ libraries: ["Gio-2.0", "Json-1.0"], girPath, gi: root.gi, jsx: root.jsx });
        expect(
            diagnostics(app, `import { Parser } from "@gtkx/gi/json"; export const parser: Parser = new Parser();`),
        ).not.toEqual([]);
        expect(
            diagnostics(
                directory.path,
                `import { Parser } from "@gtkx/gi/json"; export const parser: Parser = new Parser();`,
            ),
        ).toEqual([]);
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

    it("marks deprecated slot props as deprecated", async () => {
        using directory = createProject();
        const outDir = join(directory.path, "reference");
        writeDocs({
            ...(await readBuiltinElementsForDocs()),
            libraries: ["Adw-1"],
            girPath: resolveGirPath(undefined, directory.path),
            resolveFrom: directory.path,
            outDir,
        });
        const block = (name: string) =>
            readFileSync(join(outDir, "adw", "toolbar-view.md"), "utf8")
                .split(`### \`${name}\``)[1]
                ?.split("### ")[0];
        expect(block("topBar")).toContain("deprecated");
        expect(block("topBar")).toContain("`top`");
        expect(block("top")).not.toContain("deprecated");
    });

    it("marks configured construct-only props as construct-only", async () => {
        using directory = createProject();
        const outDir = join(directory.path, "reference");
        writeDocs({
            ...(await readBuiltinElementsForDocs()),
            libraries: ["Adw-1"],
            girPath: resolveGirPath(undefined, directory.path),
            resolveFrom: directory.path,
            outDir,
        });
        const block = (namespace: string, page: string, name: string) =>
            readFileSync(join(outDir, namespace, `${page}.md`), "utf8")
                .split(`### \`${name}\``)[1]
                ?.split("### ")[0];
        expect(block("gio", "menu-item", "label")).toContain("construct-only");
        expect(block("gio", "menu-item", "action")).toContain("construct-only");
        expect(block("gio", "menu-item", "section")).not.toContain("construct-only");
        expect(block("gtk", "shortcut-trigger", "accelerator")).toContain("construct-only");
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

    it("documents element constructors and defaults as the declarations type them", async () => {
        using directory = createProject();
        const outDir = join(directory.path, "reference");
        writeDocs({
            ...(await readBuiltinElementsForDocs()),
            libraries: ["Adw-1"],
            girPath: resolveGirPath(undefined, directory.path),
            resolveFrom: directory.path,
            outDir,
        });
        const page = (namespace: string, name: string) => readFileSync(join(outDir, namespace, `${name}.md`), "utf8");
        expect(page("gtk", "overlay")).toContain("new(): Gtk.Overlay");
        expect(page("adw", "timed-animation")).toMatch(/new\([^)]*\): Adw\.TimedAnimation/);
        expect(page("gtk", "range")).toContain("default `1.7976931348623157e+308`");
        expect(page("gtk", "aspect-frame")).toContain("default `0.5`");
        expect(page("gtk", "progress-bar")).toContain("default `Gtk.Orientation.HORIZONTAL`");
        expect(page("gtk", "font-chooser-widget")).toContain(
            "default `Gtk.FontChooserLevel.STYLE | Gtk.FontChooserLevel.SIZE`",
        );
    });

    it("constructs records with new through their new constructor like GJS", async () => {
        using directory = createProject();
        writeFileSync(
            join(directory.path, "Digest-1.0.gir"),
            `<?xml version="1.0"?>
             <repository version="1.0" xmlns="http://www.gtk.org/introspection/core/1.0"
               xmlns:c="http://www.gtk.org/introspection/c/1.0" xmlns:glib="http://www.gtk.org/introspection/glib/1.0">
               <include name="GLib" version="2.0"/>
               <namespace name="Digest" version="1.0" shared-library="libglib-2.0.so.0" c:prefix="G">
                 <record name="Checksum" c:type="GChecksum" copy-function="g_checksum_copy"
                   free-function="g_checksum_free">
                   <constructor name="new" c:identifier="g_checksum_new">
                     <return-value transfer-ownership="full" nullable="1"><type name="Checksum"/></return-value>
                     <parameters>
                       <parameter name="checksum_type" transfer-ownership="none"><type name="gint"/></parameter>
                     </parameters>
                   </constructor>
                   <method name="get_string" c:identifier="g_checksum_get_string">
                     <return-value transfer-ownership="none"><type name="utf8"/></return-value>
                     <parameters>
                       <instance-parameter name="checksum" transfer-ownership="none"><type name="Checksum"/></instance-parameter>
                     </parameters>
                   </method>
                 </record>
               </namespace>
             </repository>`,
        );
        const girPath = resolveGirPath([directory.path], directory.path);
        const libraries = ["GLib-2.0", "Digest-1.0"];
        const { gi } = resolveStore(directory.path);
        await runCodegen({ libraries, girPath, gi });
        const consumer = `import { Checksum } from "@gtkx/gi/digest";
            import { ChecksumType, KeyFile, TimeZone, VariantType } from "@gtkx/gi/glib";
            const type: VariantType = new VariantType("s");
            const file: KeyFile = new KeyFile();
            const checksum: Checksum = new Checksum(ChecksumType.SHA256);
            const failures: string[] = [];
            for (const construct of [
                // @ts-expect-error the new constructor takes a type string
                () => new VariantType(),
                () => new Checksum(-1),
                // @ts-expect-error a zero-argument constructor other than new keeps the record abstract
                () => new TimeZone("UTC"),
            ]) {
                try {
                    construct();
                } catch (error) {
                    failures.push(String(error));
                }
            }
            console.log(JSON.stringify({
                type: type instanceof VariantType && type.dupString(),
                file: file instanceof KeyFile,
                checksum: checksum instanceof Checksum && checksum.getString().length,
                failures,
            }));`;
        expect(diagnostics(directory.path, consumer)).toEqual([]);
        const output = execFileSync(process.execPath, ["consumer.ts"], {
            cwd: directory.path,
            encoding: "utf8",
            stdio: "pipe",
            timeout: 20_000,
        });
        expect(JSON.parse(output)).toEqual({
            type: "s",
            file: true,
            checksum: 64,
            failures: [
                expect.stringContaining("Missing required argument"),
                expect.stringContaining("Cannot construct Digest.Checksum: Digest.Checksum.new returned null."),
                expect.stringContaining("Cannot construct GLib.TimeZone with new"),
            ],
        });
        const reference = loadApiReference({ libraries, girPath, resolveFrom: directory.path });
        const page = (name: string) => {
            const result = reference.lookup(name);
            return result.outcome === "page" ? result.markdown : "";
        };
        expect(page("GLib.VariantType")).toContain("`new GLib.VariantType(...)` calls `GLib.VariantType.new(...)`.");
        expect(page("GLib.TimeZone")).toContain("## Constructors");
        expect(page("GLib.TimeZone")).not.toContain("`new GLib.TimeZone(...)`");
    });

    it("returns null from nullable zero-terminated arrays like GJS", async () => {
        using directory = createProject();
        const { gi } = resolveStore(directory.path);
        await runCodegen({ libraries: ["Gio-2.0"], girPath: resolveGirPath(undefined, directory.path), gi });
        const consumer = `import { DataInputStream, MemoryInputStream } from "@gtkx/gi/gio";
            import { Bytes } from "@gtkx/gi/glib";
            const reader = DataInputStream.new(MemoryInputStream.newFromBytes(Bytes.new(new TextEncoder().encode("a\\n\\nb"))));
            const lines: (string | null)[] = [];
            for (let index = 0; index < 4; index += 1) {
                const [line]: [Uint8Array | null, number] = reader.readLine(null);
                lines.push(line === null ? null : new TextDecoder().decode(line));
            }
            console.log(JSON.stringify({ lines, empty: Bytes.new(new Uint8Array()).getData() }));`;
        expect(diagnostics(directory.path, consumer)).toEqual([]);
        const output = execFileSync(process.execPath, ["consumer.ts"], {
            cwd: directory.path,
            encoding: "utf8",
            stdio: "pipe",
            timeout: 20_000,
        });
        expect(JSON.parse(output)).toEqual({ lines: ["a", "", "b", null], empty: {} });
    });

    it("reads embedded records that hold pointers as read-only views like GJS", async () => {
        using directory = createProject();
        const libraries = ["PangoCairo-1.0"];
        const girPath = resolveGirPath(undefined, directory.path);
        const { gi } = resolveStore(directory.path);
        await runCodegen({ libraries, girPath, gi });
        const consumer = `import { Analysis, AttrList, Font, itemize } from "@gtkx/gi/pango";
            import { FontMap } from "@gtkx/gi/pangocairo";
            const context = FontMap.getDefault().createContext();
            const [item] = itemize(context, "Hello", 0, 5, AttrList.new(), null);
            const analysis: Analysis = item.analysis;
            const assign = () => {
                // @ts-expect-error an embedded record is read-only
                item.analysis = analysis;
            };
            console.log(JSON.stringify({
                isView: analysis instanceof Analysis,
                font: analysis.font instanceof Font,
                level: analysis.level,
                length: item.length,
                assign: typeof assign,
            }));`;
        expect(diagnostics(directory.path, consumer)).toEqual([]);
        const output = execFileSync(process.execPath, ["consumer.ts"], {
            cwd: directory.path,
            encoding: "utf8",
            stdio: "pipe",
            timeout: 20_000,
        });
        expect(JSON.parse(output)).toEqual({ isView: true, font: true, level: 0, length: 5, assign: "function" });
        const reference = loadApiReference({ libraries, girPath, resolveFrom: directory.path });
        const item = reference.lookup("Pango.Item");
        expect(item.outcome === "page" ? item.markdown : "").toContain(
            "### `analysis`\n\n`Pango.Analysis` · read-only",
        );
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
        const domainPage = reference.lookup("Gio.DBusError");
        expect(domainPage.outcome === "page" ? domainPage.markdown : "").toContain(
            "| `Gio.DBusError.getRemoteError()` | `Gio.dbusErrorGetRemoteError()` |",
        );
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

    it("initializes a library whose GIR declares an init function when its namespace is imported", async () => {
        using directory = createProject();
        const { gi } = resolveStore(directory.path);
        await runCodegen({ libraries: ["GstPbutils-1.0"], girPath: resolveGirPath(undefined, directory.path), gi });
        const initialized = execFileSync(
            process.execPath,
            [
                "--input-type=module",
                "-e",
                `import * as GstPbutils from "@gtkx/gi/gstpbutils";
                import * as Gst from "@gtkx/gi/gst";
                console.log(JSON.stringify([Gst.isInitialized(), typeof GstPbutils.Discoverer]));`,
            ],
            { cwd: directory.path, encoding: "utf8", stdio: "pipe", timeout: 20_000 },
        );
        expect(JSON.parse(initialized)).toEqual([true, "function"]);
    });

    it("leaves library teardown to process exit", async () => {
        using directory = createProject();
        const { gi } = resolveStore(directory.path);
        await runCodegen({ libraries: ["GtkSource-5"], girPath: resolveGirPath(undefined, directory.path), gi });
        const bootstrap = readFileSync(join(gi.linkDir, "gtksource", "bootstrap.js"), "utf8");
        expect(bootstrap).toContain("init();");
        expect(bootstrap).not.toContain("finalize");
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
