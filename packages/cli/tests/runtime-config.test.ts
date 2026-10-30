import { createConfigLoader } from "@gtkx/config/internal";
import { runCommand } from "citty";
import { execFileSync } from "node:child_process";
import { cpSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";
import { describe, expect, it } from "vitest";
import { createCommand } from "../dist/command.js";
import { gtkxVitePlugins } from "../dist/vite-plugins/index.js";
import gtkx from "../dist/vitest-plugin.js";
import { createProject } from "./project.js";

const frenchEnvironment = { ...process.env, LANG: "fr_FR.UTF-8", LC_ALL: "fr_FR.UTF-8", LANGUAGE: "fr" };
const chineseEnvironment = { ...process.env, LANG: "zh_CN.UTF-8", LC_ALL: "zh_CN.UTF-8", LANGUAGE: "zh_CN" };
const unsupportedLocaleEnvironment = { ...process.env, LANG: "xx_YY.UTF-8", LC_ALL: "xx_YY.UTF-8", LANGUAGE: "fr" };

describe("runtime configuration", () => {
    it("keeps the preloaded configuration when it changes before Vite starts", async () => {
        using project = createProject();
        const configFile = "custom.config.ts";
        const config = `export default {
            applicationId: "org.gtkx.production",
            codegen: false,
            $development: { applicationId: "org.gtkx.initial" },
        };`;
        project.write(configFile, config);
        project.write("src/index.ts", 'export { applicationId, resourceBasePath } from "virtual:gtkx-config";');
        const loadConfig = createConfigLoader({
            configFile,
            mode: "development",
            shouldWarnGraduatedFuture: false,
        });
        await loadConfig.load(project.root);
        project.write(configFile, config.replace("org.gtkx.initial", "org.gtkx.changed"));
        const entryPath = join(project.root, "src/index.ts");
        const server = await createServer({
            configFile: false,
            root: project.root,
            plugins: gtkxVitePlugins({ configFile, entryPath, mode: "development", loadConfig }),
            server: { middlewareMode: true, ws: false },
            appType: "custom",
        });
        try {
            const entry = await server.ssrLoadModule(entryPath);
            expect(entry.applicationId).toBe("org.gtkx.initial");
            expect(entry.resourceBasePath).toBe("/org/gtkx/initial");
        } finally {
            await server.close();
        }
    });

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
        project.write("po/LINGUAS", "fr\nzh_CN\n");
        project.write("po/fr.po", readFileSync(new URL("../../i18n/tests/fixtures/fr.po", import.meta.url), "utf8"));
        project.write(
            "src/message.ts",
            `import { t } from "@gtkx/i18n";
            const files = t("{{count}} file", { count: 2, defaultValue_one: "{{count}} file", defaultValue_other: "{{count}} files" });
            export const greeting = t("Hello, {{name}}!", { name: "Ada" }) + " " + files;`,
        );
        project.write(
            "src/index.ts",
            'const { greeting } = await import("./message.js"); console.log(greeting); process.exit(0);',
        );

        await runCommand(createCommand(), { rawArgs: ["build", "--cwd", project.root] });
        const runBundle = (path: string, env = frenchEnvironment) =>
            execFileSync(process.execPath, [path], {
                encoding: "utf8",
                env,
                timeout: 30_000,
            });
        expect(runBundle(join(project.root, "dist/bundle.mjs"))).toContain("Bonjour, Ada ! 2 fichiers");
        expect(runBundle(join(project.root, "dist/bundle.mjs"), chineseEnvironment)).toContain("Hello, Ada! 2 files");
        expect(runBundle(join(project.root, "dist/bundle.mjs"), unsupportedLocaleEnvironment)).toContain("Hello, Ada!");
        const translateName = (locale: string, name: string) =>
            project.write(
                `po/${locale}.po`,
                `${readFileSync(join(project.root, `po/${locale}.po`), "utf8")}\nmsgid "CLI Example"\nmsgstr "${name}"\n`,
            );
        const configPath = join(project.root, "gtkx.config.ts");
        project.write(
            "gtkx.config.ts",
            readFileSync(configPath, "utf8").replace("Exercises translated deployment", "Ships translated catalogs"),
        );
        translateName("fr", "CLI Example");
        translateName("zh_CN", "CLI 示例");
        await runCommand(createCommand(), {
            rawArgs: ["deploy", "--cwd", project.root, "--skip-build", "--print-manifests", "--target", "deb"],
        });
        const stage = join(project.root, "build", process.arch, "stage");
        const metainfo = readFileSync(join(stage, "share/metainfo/org.gtkx.example.metainfo.xml"), "utf8");
        expect(metainfo.match(/<name xml:lang="[^"]+">[^<]*<\/name>/g)?.toSorted()).toEqual([
            '<name xml:lang="fr">CLI Example</name>',
            '<name xml:lang="zh-Hans-CN">CLI 示例</name>',
        ]);
        expect(metainfo).toContain("<summary>Ships translated catalogs</summary>");
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

    it("retains imported schema dependencies across process restarts during invalid edits", () => {
        using project = createProject();
        project.write(
            "base.gschema.xml",
            `<schemalist><schema id="org.gtkx.base">
                <key name="value" type="s"><default>'initial'</default></key>
            </schema></schemalist>`,
        );
        project.write(
            "alternate.gschema.xml",
            `<schemalist><schema id="org.gtkx.base">
                <key name="value" type="s"><default>'updated'</default></key>
                <key name="enabled" type="b"><default>true</default></key>
            </schema></schemalist>`,
        );
        project.write(
            "child.gschema.xml",
            '<schemalist><schema id="org.gtkx.child" path="/org/gtkx/child/" extends="org.gtkx.base"/></schemalist>',
        );
        project.write("src/index.ts", 'export { default } from "../child.gschema.xml";');
        const original = 'export { default } from "../base.gschema.xml";';
        const replacement = 'export { default } from "../alternate.gschema.xml";';
        project.write("src/base.ts", original);
        project.write(
            "start.mjs",
            `import { createServer } from ${JSON.stringify(import.meta.resolve("vite"))};
            import gtkx from ${JSON.stringify(new URL("../dist/vitest-plugin.js", import.meta.url).href)};
            import { execFileSync } from "node:child_process";
            const server = await createServer({
                configFile: false,
                root: process.argv[2],
                plugins: gtkx(),
                server: { middlewareMode: true, ws: false, watch: null },
                appType: "custom",
            });
            try {
                const schemaDir = server.config.test?.env?.GSETTINGS_SCHEMA_DIR;
                console.log(execFileSync("gsettings", ["get", "org.gtkx.child", "value"], {
                    encoding: "utf8",
                    env: { ...process.env, GSETTINGS_SCHEMA_DIR: schemaDir, GSETTINGS_BACKEND: "memory" },
                }).trim());
            } finally {
                await server.close();
            }`,
        );
        const start = () =>
            execFileSync(process.execPath, [join(project.root, "start.mjs"), project.root], {
                encoding: "utf8",
                timeout: 30_000,
            }).trim();
        const declarations = () => readFileSync(join(project.root, "node_modules/.gtkx/env.d.ts"), "utf8");

        expect(start()).toBe("'initial'");
        const initialDeclarations = declarations();
        project.write("src/base.ts", `${original} export const =`);
        expect(start()).toBe("'initial'");
        expect(declarations()).toBe(initialDeclarations);

        project.write("src/base.ts", replacement);
        expect(start()).toBe("'updated'");
        expect(declarations()).toContain("alternate.gschema.xml");
        expect(declarations()).not.toContain("base.gschema.xml");
        expect(declarations()).toContain("enabled");
        project.write("src/base.ts", `${replacement} export const =`);
        expect(start()).toBe("'updated'");
    });
});
