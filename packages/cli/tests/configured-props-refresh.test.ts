import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { coverageTimeout, createCliProject, startCli } from "./cli-project.js";
import {
    installConfiguredProps,
    OUTPUT,
    PROPS_MODULE,
    readButton,
    runDocs,
    stamp,
    writePropsConfig,
} from "./configured-props-fixture.js";

const READ_BARRIER = `import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
const read = fs.readFileSync;
const wait = new Int32Array(new SharedArrayBuffer(4));
let entered = false;
fs.readFileSync = (file, ...args) => {
    const result = read(file, ...args);
    if (!entered && file === process.env.GTKX_PROPS_INPUT) {
        entered = true;
        fs.writeFileSync(process.env.GTKX_PROPS_READY, "");
        while (!fs.existsSync(process.env.GTKX_PROPS_RELEASE)) {
            Atomics.wait(wait, 0, 0, 10);
        }
    }
    return result;
};
syncBuiltinESMExports();
`;
const BASE_DECLARATION = "export interface SharedProps<T> { auditReplacement: T; }\n";
const REEXPORT_DECLARATION = "export interface ReexportedProps { auditEarlier?: Date; }\n";

describe("configured element prop reference", () => {
    it("refreshes after a declaration changes during the first documentation build", async () => {
        using project = createCliProject({ prefix: "gtkx-props-snapshot-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        const declaration = join(project.nodeModules, "@audit/element-base/index.d.ts");
        const barrier = join(project.root, "read-barrier.mjs");
        const ready = join(project.root, "read-ready");
        const released = join(project.root, "read-release");
        writeFileSync(barrier, READ_BARRIER);
        const child = startCli(project, ["docs", "--out", OUTPUT], {
            NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import ${pathToFileURL(barrier).href}`,
            GTKX_PROPS_INPUT: declaration,
            GTKX_PROPS_READY: ready,
            GTKX_PROPS_RELEASE: released,
        });
        const closed: Promise<number | null> = new Promise((resolve, reject) => {
            child.once("error", (error) => {
                reject(error);
            });
            child.once("close", (status) => {
                resolve(status);
            });
        });

        try {
            await expect.poll(() => existsSync(ready), { timeout: coverageTimeout(60_000) }).toBe(true);
            writeFileSync(declaration, BASE_DECLARATION);
            writeFileSync(released, "");
            const status = await closed;
            expect(status).toBe(0);
            expect(readButton(project.root)).toContain("### `auditCaption`");
            runDocs(project);
            expect(readButton(project.root)).toContain("### `auditReplacement`");
            expect(readButton(project.root)).not.toContain("### `auditCaption`");
        } finally {
            writeFileSync(released, "");

            if (child.exitCode === null && child.signalCode === null) {
                child.kill("SIGTERM");
                await closed;
            }
        }
    });

    it.each(["utf8", "utf16le"] as const)("keeps unchanged %s BOM declarations cached", (encoding) => {
        using project = createCliProject({ prefix: "gtkx-props-bom-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        const declaration = join(project.nodeModules, "@audit/element-base/index.d.ts");
        writeFileSync(declaration, "\u{FEFF}" + readFileSync(declaration, "utf8"), encoding);
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditCaption`");
        const before = stamp(project.root);
        runDocs(project);
        expect(stamp(project.root)).toBe(before);
    });

    it("invalidates cached pages when a transitive declaration changes", () => {
        using project = createCliProject({ prefix: "gtkx-props-freshness-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        runDocs(project);
        const before = stamp(project.root);
        runDocs(project);
        expect(stamp(project.root)).toBe(before);
        writeFileSync(join(project.nodeModules, "@audit/element-base/index.d.ts"), BASE_DECLARATION);
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditReplacement`");
        expect(readButton(project.root)).not.toContain("### `auditCaption`");
    });

    it("follows reexports when an earlier declaration source appears", () => {
        using project = createCliProject({ prefix: "gtkx-props-reexport-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root, "ReexportedProps");
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditReexported`");
        writeFileSync(join(project.nodeModules, PROPS_MODULE, "reexport.ts"), REEXPORT_DECLARATION);
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditEarlier`");
        expect(readButton(project.root)).not.toContain("### `auditReexported`");
    });
});
