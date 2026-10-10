import { runCommand } from "citty";
import { execFileSync } from "node:child_process";
import { cpSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";
import { describe, expect, it } from "vitest";
import { createCommand } from "../dist/command.js";
import gtkx from "../dist/vitest-plugin.js";
import { createProject } from "./project.js";

const frenchEnvironment = { ...process.env, LANG: "fr_FR.UTF-8", LC_ALL: "fr_FR.UTF-8", LANGUAGE: "fr" };

describe("runtime configuration", () => {
    it("keeps translations working in built and relocated deployment bundles", async () => {
        using project = createProject({
            applicationIcon: "icon.svg",
            deploy: {
                name: "CLI Example",
                summary: "Exercises translated deployment",
                categories: ["Utility"],
                description: ["An application used to verify relocated translation catalogs."],
                developer: { name: "GTKX", email: "hello@gtkx.dev" },
                license: "MIT",
                homepage: "https://gtkx.dev",
                node: { source: "host", shouldStrip: false },
            },
        });
        project.write("LICENSE", "MIT License\nCopyright GTKX\nPermission is hereby granted, free of charge.\n");
        project.write("icon.svg", '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>');
        project.write("po/LINGUAS", "fr\n");
        project.write("po/fr.po", readFileSync(new URL("../../i18n/tests/fixtures/fr.po", import.meta.url), "utf8"));
        project.write(
            "src/message.ts",
            'import { t } from "@gtkx/i18n"; export const greeting = t("Hello, {{name}}!", { name: "Ada" });',
        );
        project.write(
            "src/index.ts",
            'const { greeting } = await import("./message.js"); console.log(greeting); process.exit(0);',
        );

        await runCommand(createCommand(), { rawArgs: ["build", "--cwd", project.root] });
        const runBundle = (path: string) =>
            execFileSync(process.execPath, [path], {
                encoding: "utf8",
                env: frenchEnvironment,
                timeout: 30_000,
            });
        expect(runBundle(join(project.root, "dist/bundle.mjs"))).toContain("Bonjour, Ada !");
        await runCommand(createCommand(), {
            rawArgs: ["deploy", "--cwd", project.root, "--skip-build", "--print-manifests", "--target", "deb"],
        });
        const stage = join(project.root, "build", process.arch, "stage");
        const relocated = join(project.root, "relocated");
        cpSync(stage, relocated, { recursive: true });
        const [binary] = readdirSync(join(relocated, "lib"));
        if (binary === undefined) throw new Error("Missing deployed application");
        expect(runBundle(join(relocated, "lib", binary, "bundle.mjs"))).toContain("Bonjour, Ada !");
        const manifestPath = "dist/gtkx-schemas.json";
        const manifest = readFileSync(join(project.root, manifestPath), "utf8");
        project.write(manifestPath, manifest.replace(/"formatVersion":\s*4/, '"formatVersion":3'));
        await expect(
            runCommand(createCommand(), {
                rawArgs: ["deploy", "--cwd", project.root, "--skip-build", "--print-manifests", "--target", "deb"],
            }),
        ).rejects.toThrow("Run `gtkx build` again");
    });

    it("keeps two Vite projects' schema directories independent through shutdown", async () => {
        using first = createProject();
        using second = createProject();
        const schemaId = "org.gtkx.example";
        const schemaName = `${schemaId}.gschema.xml`;
        for (const [project, value] of [
            [first, "first"],
            [second, "second"],
        ] as const) {
            project.write(
                schemaName,
                `<schemalist><schema id="${schemaId}" path="/org/gtkx/example/">
                <key name="value" type="s"><default>'${value}'</default></key>
            </schema></schemalist>`,
            );
            project.write("src/index.ts", `export { default } from "../${schemaName}";`);
        }
        const open = (root: string) =>
            createServer({
                configFile: false,
                root,
                plugins: gtkx(),
                server: { middlewareMode: true, ws: false },
                appType: "custom",
            });
        const firstServer = await open(first.root);
        const secondServer = await open(second.root);
        const value = (server: typeof firstServer) => {
            const schemaDir = server.config.test?.env?.GSETTINGS_SCHEMA_DIR;
            if (typeof schemaDir !== "string") throw new Error("Missing schema search path");
            return execFileSync("gsettings", ["get", schemaId, "value"], {
                encoding: "utf8",
                env: { ...process.env, GSETTINGS_SCHEMA_DIR: schemaDir, GSETTINGS_BACKEND: "memory" },
            }).trim();
        };
        try {
            await firstServer.ssrLoadModule(join(first.root, "src/index.ts"));
            await secondServer.ssrLoadModule(join(second.root, "src/index.ts"));
            expect(value(firstServer)).toBe("'first'");
            expect(value(secondServer)).toBe("'second'");
            await firstServer.close();
            expect(value(secondServer)).toBe("'second'");
        } finally {
            await firstServer.close();
            await secondServer.close();
        }
    });
});
