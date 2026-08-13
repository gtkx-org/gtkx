import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ResolveIdHook } from "./plugin-hook-types.js";
import { gtkxStoreLinks } from "../../src/vite-plugins/store-links.js";
import { getLinkDir, getStoreDir, installPackage, setupProjectRoot, writeStore } from "./store-project.js";

type ConfigHook = (config: { root?: string }) => void;

const project = setupProjectRoot("gtkx-store-links-plugin-");

const installProject = (): void => {
    installPackage(project.root, "runtime");
    installPackage(project.root, "react", { exports: {} });
    writeStore(project.root, "gi", ["gtk"]);
    writeStore(project.root, "jsx", ["gtk"]);
};

const resolveSource = (source: string): Promise<string | undefined | null> => {
    const plugin = gtkxStoreLinks();
    (plugin.config as ConfigHook)({ root: project.root });

    return Promise.resolve(
        (plugin.resolveId as ResolveIdHook).call(
            { resolve: () => Promise.resolve(null) },
            source,
            join(project.root, "src", "app.tsx"),
            {},
        ),
    );
};

const isLinkedTo = (name: "gi" | "jsx"): boolean =>
    existsSync(getLinkDir(project.root, name)) &&
    realpathSync(getLinkDir(project.root, name)) === realpathSync(getStoreDir(project.root, name));

describe("gtkxStoreLinks (plugin shape)", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxStoreLinks();
        expect(plugin.name).toBe("gtkx:store-links");
        expect(plugin.enforce).toBe("pre");
    });
});

describe("gtkxStoreLinks (resolveId)", () => {
    it("restores the links an install pruned mid-session, before the import resolves", async () => {
        installProject();
        expect(existsSync(getLinkDir(project.root, "gi"))).toBe(false);
        await resolveSource("@gtkx/gi/gtk");
        expect(isLinkedTo("gi")).toBe(true);
        expect(isLinkedTo("jsx")).toBe(true);
    });

    it("restores them for a jsx import too", async () => {
        installProject();
        await resolveSource("@gtkx/jsx/gtk");
        expect(isLinkedTo("jsx")).toBe(true);
    });

    it("leaves the resolution itself to the rest of the plugin stack", async () => {
        installProject();
        expect(await resolveSource("@gtkx/gi/gtk")).toBeUndefined();
    });

    it("touches nothing for an import that is not a generated module", async () => {
        installProject();

        for (const source of ["@gtkx/react", "react", "./app.tsx", "@gtkx/gi"]) {
            await resolveSource(source);
        }

        expect(existsSync(getLinkDir(project.root, "gi"))).toBe(false);
        expect(existsSync(getLinkDir(project.root, "jsx"))).toBe(false);
    });

    it("resolves on when the project has no generated store at all", async () => {
        expect(await resolveSource("@gtkx/gi/gtk")).toBeUndefined();
        expect(existsSync(join(project.root, "node_modules", "@gtkx"))).toBe(false);
    });
});
