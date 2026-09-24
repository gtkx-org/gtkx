import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, runNativeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.loadableicon", libraries: ["Gio-2.0"],' +
    " agents: { reference: false, rules: false } };";
const IMPORTS = 'import * as Gio from "@gtkx/gi/gio";\nimport * as GLib from "@gtkx/gi/glib";\n';
const CONSUMER = IMPORTS + `import assert from "node:assert/strict";
import { mkdtempDisposableSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { keepAlive } from "@gtkx/native";
import { getHandle, promisify, quit, registerClass, t } from "@gtkx/runtime";

type Loaded = ReturnType<Gio.LoadableIcon["load"]>;
export const nullable = (stream: Gio.InputStream): Loaded => [stream, null];
export const nullableFinish = (stream: Gio.InputStream): ReturnType<Gio.LoadableIcon["loadFinish"]> => [stream, null];
export const nullableAsync = (stream: Gio.InputStream): Awaited<ReturnType<Gio.LoadableIcon["loadAsync"]>> =>
    [stream, null];
export const virtual = (stream: Gio.InputStream): ReturnType<Gio.LoadableIcon["vfuncLoad"]> => [stream, null];
export const virtualFinish = (stream: Gio.InputStream): ReturnType<Gio.LoadableIcon["vfuncLoadFinish"]> =>
    [stream, null];
const payload = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">' +
    '<rect width="1" height="1" fill="red"/></svg>');

const check = ([stream, type]: Loaded, expected: string | null): void => {
    try {
        assert.equal(type, expected);
        const bytes: number[] = [];
        for (;;) {
            const block = stream.readBytes(4096, null);
            if (block.getSize() === 0) {
                break;
            }
            const chunk = block.getData();
            assert.ok(chunk !== null);
            bytes.push(...chunk);
        }
        assert.deepEqual(Uint8Array.from(bytes), payload);
    } finally {
        stream.close(null);
    }
    assert.equal(stream.isClosed(), true);
};

const start = t.fn("libgio-2.0.so.0", "g_loadable_icon_load_async", {
    args: [
        { type: t.object("borrowed") },
        { type: t.int32 },
        { type: t.object("borrowed") },
        { type: t.callback([
            t.object("borrowed"), t.object("borrowed", () => Gio.AsyncResult), t.biguint64,
        ], t.void, { hasUserData: true, userDataIndex: 2, scope: "async" }) },
    ],
    returns: t.void,
});
const finish = (icon: Gio.LoadableIcon, cancellable: Gio.Cancellable | null): Promise<Loaded> =>
    promisify(start, (result: Gio.AsyncResult) => icon.loadFinish(result), cancellable, getHandle(icon), 16);

class TypedIcon extends Gio.BytesIcon {
    contentType: string | null = null;

    override vfuncLoad(size: number, cancellable: Gio.Cancellable | null): Loaded {
        const [stream] = super.vfuncLoad(size, cancellable);
        return [stream, this.contentType];
    }

    override vfuncLoadFinish(result: Gio.AsyncResult): ReturnType<Gio.LoadableIcon["vfuncLoadFinish"]> {
        const [stream] = super.vfuncLoadFinish(result);
        return [stream, this.contentType];
    }
}
registerClass(TypedIcon, { typeName: "GtkxNullableLoadableIcon" });

keepAlive(true);
try {
    using temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-loadable-icon-"));
    const path = join(temporary.path, "icon.svg");
    writeFileSync(path, payload);
    const bytes = GLib.Bytes.new(payload);
    const fileIcon = Gio.FileIcon.new(Gio.File.newForPath(path));
    const bytesIcon = Gio.BytesIcon.new(bytes);
    for (const icon of [fileIcon, bytesIcon]) {
        check(icon.load(16, null), null);
        check(await icon.loadAsync(16), null);
        check(await finish(icon, null), null);
    }

    const typed = new TypedIcon({ bytes });
    check(typed.load(16, null), null);
    check(await typed.loadAsync(16), null);
    typed.contentType = "image/svg+xml";
    check(typed.load(16, null), "image/svg+xml");
    check(await finish(typed, null), "image/svg+xml");

    const missing = Gio.FileIcon.new(Gio.File.newForPath(join(temporary.path, "missing.svg")));
    assert.throws(() => missing.load(16, null));
    await assert.rejects(missing.loadAsync(16));
    await assert.rejects(finish(missing, null));
    const cancelled = new Gio.Cancellable();
    cancelled.cancel();
    assert.throws(() => fileIcon.load(16, cancelled));
    await assert.rejects(fileIcon.loadAsync(16, cancelled));
    await assert.rejects(finish(fileIcon, cancelled));
    check(await fileIcon.loadAsync(16), null);
} finally {
    keepAlive(false);
    quit();
}
`;
const CONTROL = IMPORTS + `export const stream = (icon: Gio.LoadableIcon): Gio.InputStream => icon.load(16, null)[0];
`;
const REJECTED = {
    "load.ts": "export const read = (icon: Gio.LoadableIcon): string => icon.load(16, null)[1];",
    "load-async.ts": "export const read = async (icon: Gio.LoadableIcon): Promise<string> => " +
        "(await icon.loadAsync(16))[1];",
    "load-finish.ts": "export const read = (icon: Gio.LoadableIcon, result: Gio.AsyncResult): string => " +
        "icon.loadFinish(result)[1];",
    "vfunc-load.ts": "export const read = (icon: Gio.LoadableIcon): string => icon.vfuncLoad(16, null)[1];",
    "vfunc-load-finish.ts": "export const read = (icon: Gio.LoadableIcon, result: Gio.AsyncResult): string => " +
        "icon.vfuncLoadFinish(result)[1];",
};
const rejectedFiles = Object.fromEntries(Object.entries(REJECTED).map(([file, source]) => [file, IMPORTS + source]));

describe("generated loadable icon nullable content types", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-loadable-icon-types-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER, "control.ts": CONTROL, ...rejectedFiles },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts nullable native results and subclass overrides", () => {
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it("preserves non-null streams", () => {
        expect(typecheckFile(project, "control.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects non-null content type assumptions in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("documents nullable method and virtual results", () => {
        const reference = loadApiReference({
            libraries: ["Gio-2.0"],
            girPath: resolveGirPath(undefined, project.root),
            resolveFrom: project.root,
        });
        const page = reference.lookup("Gio.LoadableIcon", "interface");
        const tuple = "[Gio.InputStream, string | null]";
        expect(page.outcome).toBe("page");
        expect(page).toHaveProperty("markdown", expect.stringContaining(
            `load(size: number, cancellable: Gio.Cancellable | null): ${tuple}`,
        ));
        expect(page).toHaveProperty("markdown", expect.stringContaining(
            `loadAsync(size: number, cancellable?: Gio.Cancellable | null): Promise<${tuple}>`,
        ));
        expect(page).toHaveProperty("markdown", expect.stringContaining(`loadFinish(res: Gio.AsyncResult): ${tuple}`));
        expect(page).toHaveProperty("markdown", expect.stringContaining(
            `vfuncLoad(size: number, cancellable: Gio.Cancellable | null): ${tuple}`,
        ));
        expect(page).toHaveProperty("markdown", expect.stringContaining(
            `vfuncLoadFinish(res: Gio.AsyncResult): ${tuple}`,
        ));
    });

    it("loads real icon streams and preserves nullable completion results", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-loadable-icon-values-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});
