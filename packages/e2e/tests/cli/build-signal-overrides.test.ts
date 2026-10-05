import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const APP_SOURCE = `import assert from "node:assert/strict";
import { Object as GObject } from "@gtkx/gi/gobject";
import { Entry, SpinButton } from "@gtkx/gi/gtk";
import { quit, registerClass, TYPE_BOOLEAN } from "@gtkx/runtime";

class PositionedEntry extends Entry {
    seen: unknown[][] = [];

    onInsertText(text: string, length: number, position: number): number {
        this.seen.push([text, length, position]);
        return position + length;
    }
}

class ParsedSpinButton extends SpinButton {
    onInput(): [number, number] {
        return [1, 23];
    }
}

try {
    const RegisteredEntry = registerClass(PositionedEntry, { typeName: "GtkxBundledPositionedEntry" });
    const entry = new RegisteredEntry();
    assert.equal(entry.emit("insert-text", "xy", 2, 3), 5);
    assert.deepEqual(entry.seen, [["xy", 2, 3]]);

    const RegisteredSpinButton = registerClass(ParsedSpinButton, { typeName: "GtkxBundledParsedSpinButton" });
    assert.deepEqual(new RegisteredSpinButton().emit("input"), [1, 23]);

    const Emitter = registerClass(class extends GObject {}, {
        typeName: "GtkxBundledObserver",
        signals: { observed: { returnType: TYPE_BOOLEAN } },
    });
    const emitter = new Emitter();
    emitter.connect("observed", () => undefined);
    assert.equal(emitter.emit("observed"), false);
    process.stdout.write("signals-ok");
} catch (error) {
    process.stderr.write(String(error));
    process.exitCode = 1;
} finally {
    quit();
}
`;

it("marshals custom signals and subclass signal outputs in a production bundle", () => {
    using project = createCliProject({
        prefix: "gtkx-build-signal-overrides-",
        config: 'export default { applicationId: "org.gtkx.signaloverridesbuild", codegen: false };\n',
        files: { "src/index.ts": APP_SOURCE },
        hasStore: true,
        shouldShareStore: true,
    });

    runCliOrThrow(project, ["build"]);
    const output = join(project.root, "dist");
    const result = spawnSync(process.execPath, [join(output, "bundle.mjs")], {
        cwd: output,
        encoding: "utf8",
        timeout: 60_000,
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("signals-ok");
});
