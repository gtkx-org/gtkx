import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, runNativeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.iochannelline", libraries: ["GLib-2.0"],' +
    " agents: { reference: false, rules: false } };";
const IMPORTS = 'import * as GLib from "@gtkx/gi/glib";\n';
const CONTROL = IMPORTS + `export const readStatus = (channel: GLib.IOChannel): GLib.IOStatus => channel.readLine()[0];
export const readLength = (channel: GLib.IOChannel): number => channel.readLine()[2];
`;
const ACCEPTED = IMPORTS + `export const exhausted: ReturnType<GLib.IOChannel["readLine"]> =
    [GLib.IOStatus.EOF, null, 0, 0];
export const read = (channel: GLib.IOChannel): string | null => {
    const [, line] = channel.readLine();
    return line === null ? null : line.toUpperCase();
};
`;
const REJECTED = IMPORTS + "export const read = (channel: GLib.IOChannel): string => channel.readLine()[1];";
const CONSUMER = IMPORTS + String.raw`import assert from "node:assert/strict";
import { mkdtempDisposableSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { quit } from "@gtkx/runtime";

try {
    using temporary = mkdtempDisposableSync(join(tmpdir(), "gtkx-iochannel-line-"));
    const populatedPath = join(temporary.path, "lines.txt");
    const emptyPath = join(temporary.path, "empty.txt");
    const invalidPath = join(temporary.path, "invalid.txt");
    writeFileSync(populatedPath, "alpha\ncafé\r\n尾");
    writeFileSync(emptyPath, "");
    writeFileSync(invalidPath, new Uint8Array([0xff]));

    const invalid = GLib.IOChannel.newFile(invalidPath, "r");
    try {
        assert.throws(() => invalid.readLine());
    } finally {
        invalid.shutdown(false);
    }

    const populated = GLib.IOChannel.newFile(populatedPath, "r");
    try {
        assert.deepEqual(populated.readLine(), [GLib.IOStatus.NORMAL, "alpha\n", 6, 5]);
        assert.deepEqual(populated.readLine(), [GLib.IOStatus.NORMAL, "café\r\n", 7, 5]);
        assert.deepEqual(populated.readLine(), [GLib.IOStatus.NORMAL, "尾", 3, 3]);
        const [status, line, length] = populated.readLine();
        assert.equal(status, GLib.IOStatus.EOF);
        assert.equal(line, null);
        assert.equal(length, 0);
    } finally {
        populated.shutdown(false);
    }

    const empty = GLib.IOChannel.newFile(emptyPath, "r");
    try {
        const [status, line, length] = empty.readLine();
        assert.equal(status, GLib.IOStatus.EOF);
        assert.equal(line, null);
        assert.equal(length, 0);
    } finally {
        empty.shutdown(false);
    }
} finally {
    quit();
}
`;

describe("generated IOChannel line result nullability", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-iochannel-line-types-",
            config: CONFIG,
            files: { "accepted.ts": ACCEPTED, "control.ts": CONTROL, "rejected.ts": REJECTED, "probe.ts": CONSUMER },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves the status and byte length results", () => {
        expect(typecheckFile(project, "control.ts")).toBe(0);
        expect(typecheckFile(project, "probe.ts")).toBe(0);
    });

    it("accepts absent lines and narrowed readers", () => {
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
    });

    it("rejects a non-null line assumption", () => {
        expect(typecheckFile(project, "rejected.ts")).not.toBe(0);
    });

    it("documents the nullable line output", () => {
        const reference = loadApiReference({
            libraries: ["GLib-2.0"],
            girPath: resolveGirPath(undefined, project.root),
            resolveFrom: project.root,
        });
        const page = reference.lookup("GLib.IOChannel", "record");
        expect(page.outcome).toBe("page");
        expect(page).toHaveProperty("markdown", expect.stringContaining(
            "readLine(): [GLib.IOStatus, string | null, number, number]",
        ));
    });

    it("reads UTF-8 lines and EOF after a conversion error", () => {
        using consumer = createCliProject({
            prefix: "gtkx-cli-iochannel-line-values-",
            config: CONFIG,
            files: { "probe.ts": CONSUMER },
        });
        runCliOrThrow(consumer, ["codegen"]);
        expect(() => {
            runNativeConsumer(consumer);
        }).not.toThrow();
    });
});
