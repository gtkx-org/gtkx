import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ResolveIdHook } from "./plugin-hook-types.js";
import { gtkxUndeclaredLibrary } from "../../src/vite-plugins/undeclared-library.js";

type ConfigHook = (config: { root?: string }) => void;
type ProjectRootRef = { root: string };

const project = setupProjectRoot();

function setupProjectRoot(): ProjectRootRef {
    const ref: ProjectRootRef = { root: "" };

    beforeEach(() => {
        ref.root = mkdtempSync(join(tmpdir(), "gtkx-undeclared-library-test-"));
    });

    afterEach(() => {
        rmSync(ref.root, { recursive: true, force: true });
    });

    return ref;
}

const setupProject = (root: string, girFiles: string[]): string => {
    const girDir = join(root, "gir-1.0");
    mkdirSync(girDir, { recursive: true });

    for (const file of girFiles) {
        writeFileSync(join(girDir, file), "");
    }

    writeFileSync(
        join(root, "gtkx.config.ts"),
        `export default { applicationId: "org.gtkx.app", girPath: [${JSON.stringify(girDir)}] };\n`,
    );

    return girDir;
};

const resolveMissing = (source: string): Promise<string | undefined | null> => {
    const plugin = gtkxUndeclaredLibrary();
    (plugin.config as ConfigHook)({ root: project.root });

    return Promise.resolve(
        (plugin.resolveId as ResolveIdHook).call({ resolve: () => Promise.resolve(null) }, source, undefined, {}),
    );
};

describe("gtkxUndeclaredLibrary (plugin shape)", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxUndeclaredLibrary();
        expect(plugin.name).toBe("gtkx:undeclared-library");
        expect(plugin.enforce).toBe("pre");
    });
});

describe("gtkxUndeclaredLibrary (resolveId)", () => {
    it("ignores sources outside the generated namespace modules", async () => {
        setupProject(project.root, ["Bindable-1.gir"]);
        await expect(resolveMissing("@gtkx/react/bindable")).resolves.toBeUndefined();
        await expect(resolveMissing("@gtkx/gi/bindable/extra")).resolves.toBeUndefined();
    });

    it("defers to the normal resolution when the namespace module exists", async () => {
        setupProject(project.root, ["Bindable-1.gir"]);
        const plugin = gtkxUndeclaredLibrary();
        (plugin.config as ConfigHook)({ root: project.root });

        const result = await (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve({ id: "/store/gi/bindable/index.js" }) },
            "@gtkx/gi/bindable",
            undefined,
            {},
        );

        expect(result).toBeUndefined();
    });

    it("names the GIR identifier to declare when the library is installed", async () => {
        setupProject(project.root, ["Bindable-1.gir"]);

        await expect(resolveMissing("@gtkx/gi/bindable")).rejects.toThrow(
            'Cannot resolve "@gtkx/gi/bindable": the "Bindable-1" bindings have not been generated. ' +
            "Add \"Bindable-1\" to `libraries` in gtkx.config.ts, then run gtkx dev or gtkx build again.",
        );
    });

    it("derives the identifier for any namespace without special-casing", async () => {
        setupProject(project.root, ["MixedCase-6.0.gir", "Latest-4.gir", "Latest-5.gir"]);
        await expect(resolveMissing("@gtkx/jsx/mixedcase")).rejects.toThrow('Add "MixedCase-6.0" to `libraries`');
        await expect(resolveMissing("@gtkx/jsx/latest")).rejects.toThrow('Add "Latest-5" to `libraries`');
    });

    it("reports the searched paths when no GIR data provides the namespace", async () => {
        const girDir = setupProject(project.root, ["Bindable-1.gir"]);

        await expect(resolveMissing("@gtkx/gi/nosuchnamespace")).rejects.toThrow(
            "Cannot resolve \"@gtkx/gi/nosuchnamespace\": the binding store has no \"nosuchnamespace\" module, " +
            `and no GIR data for it was found in [${girDir}`,
        );
    });

    it("does not claim a missing gobject-introspection package for non-namespace modules", async () => {
        setupProject(project.root, ["Bindable-1.gir"]);
        await expect(resolveMissing("@gtkx/jsx/metadata")).rejects.toThrow("run gtkx codegen to regenerate the store");
    });
});
