import { resolveHeadlessOptions, startHeadlessDisplay } from "@gtkx/vitest/headless";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { createProject, linkWorkspaceBindings } from "./project.js";
import { invoke } from "./invoke.js";

const MAX_BUNDLE_LINE_LENGTH = 500;

describe("gtkx build", () => {
    it("builds a project and protects files outside the requested output directory", async () => {
        using project = createProject();
        const output = await invoke(["build", "--cwd", project.root]);
        expect(output).toContain("Build complete");
        expect(readFileSync(join(project.root, "dist/bundle.mjs"), "utf8")).toContain("hello from build");
        project.write("keep.txt", "keep");
        await expect(invoke(["build", "--cwd", project.root, "--out", "../outside"])).rejects.toThrow();
        expect(readFileSync(join(project.root, "keep.txt"), "utf8")).toBe("keep");
    });

    it("keeps builds out of the deploy output directory that each deployment replaces", async () => {
        using project = createProject({ deploy: { outDir: "packages" } });

        await expect(invoke(["build", "--cwd", project.root, "--out", "packages/helper"])).rejects.toThrow();
        await expect(invoke(["build", "--cwd", project.root, "--out", "packages"])).rejects.toThrow();
        await invoke(["build", "--cwd", project.root, "--out", "build/helper"]);

        expect(existsSync(join(project.root, "packages"))).toBe(false);
        expect(existsSync(join(project.root, "build/helper/bundle.mjs"))).toBe(true);
    });

    it("keeps line breaks in production bundles so an error while loading points at a readable line", async () => {
        using project = createProject();
        project.write(
            "src/index.ts",
            'import { createElement } from "react";\nprocess.stdout.write(typeof createElement);',
        );

        await invoke(["build", "--cwd", project.root]);
        const lines = readFileSync(join(project.root, "dist/bundle.mjs"), "utf8").split("\n");

        expect(Math.max(...lines.map((line) => line.length))).toBeLessThan(MAX_BUNDLE_LINE_LENGTH);
    });

    it("lists installed packages but not linked workspace packages as bundled third-party code", async () => {
        using project = createProject();
        project.write(
            "packages/studio-kit/package.json",
            JSON.stringify({
                name: "@studio/kit",
                version: "0.1.0",
                private: true,
                type: "module",
                exports: "./index.js",
            }),
        );
        project.write("packages/studio-kit/index.js", "export const kitLabel = (count) => `kit ${count}`;");
        mkdirSync(join(project.root, "node_modules/@studio"));
        symlinkSync(join(project.root, "packages/studio-kit"), join(project.root, "node_modules/@studio/kit"), "dir");
        project.write(
            "src/index.ts",
            'import { kitLabel } from "@studio/kit";\nimport { createElement } from "react";\nprocess.stdout.write(kitLabel(process.argv.length) + typeof createElement);',
        );

        await invoke(["build", "--cwd", project.root]);
        const notices = readFileSync(join(project.root, "dist/BUNDLED-NOTICES"), "utf8");

        expect(notices).toContain("react");
        expect(notices).not.toContain("@studio/kit");
    });

    it("builds identical output for the same project at another path", async () => {
        const build = async () => {
            using project = createProject();
            project.write(
                "src/workers/count.ts",
                'import { parentPort } from "node:worker_threads";\nparentPort?.postMessage(1);',
            );
            project.write(
                "src/index.ts",
                'import { Worker } from "node:worker_threads";\nnew Worker(new URL("./workers/count.ts", import.meta.url));',
            );
            await invoke(["build", "--cwd", project.root]);
            const dist = join(project.root, "dist");
            return new Map(
                readdirSync(dist, { recursive: true, withFileTypes: true })
                    .filter((entry) => entry.isFile())
                    .map((entry) => join(entry.parentPath, entry.name))
                    .map((path) => [
                        relative(dist, path),
                        createHash("sha256").update(readFileSync(path)).digest("hex"),
                    ]),
            );
        };

        expect(await build()).toEqual(await build());
    });

    it("leaves an existing gettext catalog alone in a project without @gtkx/i18n", async () => {
        using project = createProject();
        rmSync(join(project.root, "node_modules/@gtkx/i18n"));
        const catalog = {
            "po/LINGUAS": "it\n",
            "po/POTFILES.in": "src/main.c\n",
            "po/it.po":
                'msgid ""\nmsgstr ""\n"Language: it\\n"\n\nmsgid "Daily Goal"\nmsgstr "Obiettivo giornaliero"\n',
        };
        for (const [path, content] of Object.entries(catalog)) {
            project.write(path, content);
        }

        await invoke(["codegen", "--cwd", project.root]);
        await invoke(["build", "--cwd", project.root]);

        expect(readdirSync(join(project.root, "po")).toSorted()).toEqual(["LINGUAS", "POTFILES.in", "it.po"]);
        for (const [path, content] of Object.entries(catalog)) {
            expect(readFileSync(join(project.root, path), "utf8")).toBe(content);
        }
    });

    it("preserves match wrappers when a production bundle imports only Regex", async () => {
        using project = createProject({ codegen: true, libraries: ["GLib-2.0"] });
        project.write(
            "src/index.ts",
            `import { Regex } from "@gtkx/gi/glib";
            const regex = Regex.new("(hello)", 0, 0);
            if (regex === null) throw new Error("Could not compile regex");
            const [matched, info] = regex.match("hello", 0);
            const replaced = regex.replaceEval("hello", 0, 0, (match, result) => {
                result.append("[" + match.fetch(0) + "]");
                return true;
            });
            process.stdout.write(JSON.stringify({ matched, matches: info.fetchAll(), replaced }));`,
        );

        await invoke(["build", "--cwd", project.root]);
        const result = await promisify(execFile)(process.execPath, [join(project.root, "dist/bundle.mjs")], {
            timeout: 30_000,
        });

        expect(JSON.parse(result.stdout)).toEqual({ matched: true, matches: ["hello", "hello"], replaced: "[hello]" });
    });

    it("keeps action entries working when a production bundle imports only an action group", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"] });
        project.write(
            "src/index.ts",
            `import { SimpleActionGroup } from "@gtkx/gi/gio";
            const group = new SimpleActionGroup();
            const calls: unknown[] = [];
            group.addActionEntries([
                { name: "open", parameterType: "s", activate: (_action, parameter) => calls.push(parameter?.unpack()) },
                { name: "size", state: "'large'" },
            ]);
            group.activateAction("open", group.getActionState("size"));
            process.stdout.write(JSON.stringify({ calls, actions: group.listActions().toSorted() }));`,
        );

        await invoke(["build", "--cwd", project.root]);
        const result = await promisify(execFile)(process.execPath, [join(project.root, "dist/bundle.mjs")], {
            timeout: 30_000,
        });

        expect(JSON.parse(result.stdout)).toEqual({ calls: ["large"], actions: ["open", "size"] });
    });

    it("keeps settings schema summaries readable in a production bundle", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"] });
        project.write(
            "data/org.gtkx.example.gschema.xml",
            `<schemalist>
                <schema id="org.gtkx.example" path="/org/gtkx/example/">
                    <key name="font" type="s">
                        <default>'Monospace 12'</default>
                        <summary>Editor font</summary>
                        <description>The font used to show documents</description>
                    </key>
                </schema>
            </schemalist>`,
        );
        project.write(
            "src/index.ts",
            `import { SettingsSchemaSource } from "@gtkx/gi/gio";
            import schema from "../data/org.gtkx.example.gschema.xml";
            const key = SettingsSchemaSource.getDefault()?.lookup(schema.id, true)?.getKey("font");
            process.stdout.write(JSON.stringify([key?.getSummary(), key?.getDescription()]));`,
        );

        await invoke(["build", "--cwd", project.root]);
        const result = await promisify(execFile)(process.execPath, [join(project.root, "dist/bundle.mjs")], {
            env: { ...process.env, GSETTINGS_BACKEND: "memory" },
            timeout: 30_000,
        });

        expect(JSON.parse(result.stdout)).toEqual(["Editor font", "The font used to show documents"]);
    });

    it("bundles and packages the GSettings schemas of a workspace package the application uses", async () => {
        using project = createProject();
        linkWorkspaceBindings(project.root);
        const app = join(project.root, "workspace/apps/recipes");
        project.write(
            "workspace/apps/recipes/package.json",
            JSON.stringify({ name: "recipes", version: "1.0.0", type: "module", dependencies: { "@studio/ui": "*" } }),
        );
        project.write(
            "workspace/apps/recipes/gtkx.config.ts",
            `export default ${JSON.stringify({
                applicationId: "org.gtkx.example",
                applicationIcon: "icon.svg",
                codegen: false,
                agents: { reference: false, rules: false },
                deploy: {
                    name: "Recipes",
                    summary: "Packages a workspace package's schema",
                    categories: ["Utility"],
                    description: ["An example application whose settings schema lives in a workspace package."],
                    developer: { id: "dev.gtkx", name: "GTKX" },
                    license: "MIT",
                    node: { source: "host" },
                },
            })};`,
        );
        project.write("workspace/apps/recipes/LICENSE", "MIT License\n");
        project.write(
            "workspace/apps/recipes/icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64"/></svg>',
        );
        project.write(
            "workspace/apps/recipes/src/index.ts",
            `import { SettingsSchemaSource } from "@gtkx/gi/gio";
            import { settings } from "@studio/ui";
            const key = SettingsSchemaSource.getDefault()?.lookup(settings.id, true)?.getKey("show-ratings");
            process.stdout.write(String(key?.getSummary()));`,
        );
        project.write(
            "workspace/packages/ui/package.json",
            JSON.stringify({
                name: "@studio/ui",
                type: "module",
                exports: "./src/index.ts",
                peerDependencies: { "@gtkx/react": "*" },
            }),
        );
        project.write(
            "workspace/packages/ui/src/index.ts",
            'export { default as settings } from "../data/org.gtkx.example.ui.gschema.xml";',
        );
        project.write(
            "workspace/packages/ui/data/org.gtkx.example.ui.gschema.xml",
            `<schemalist>
                <schema id="org.studio.ui" path="/org/studio/ui/">
                    <key name="show-ratings" type="b"><default>true</default><summary>Show ratings</summary></key>
                </schema>
            </schemalist>`,
        );
        mkdirSync(join(project.root, "workspace/node_modules/@studio"), { recursive: true });
        symlinkSync("../../packages/ui", join(project.root, "workspace/node_modules/@studio/ui"), "dir");

        await invoke(["build", "--cwd", app]);
        const result = await promisify(execFile)(process.execPath, [join(app, "dist/bundle.mjs")], {
            env: { ...process.env, GSETTINGS_BACKEND: "memory" },
            timeout: 30_000,
        });
        await invoke(["deploy", "--cwd", app, "--skip-build", "--print-manifests", "--target", "deb"]);
        const manifest = parse(readFileSync(join(app, "build", process.arch, "targets/deb/nfpm.yaml"), "utf8")) as {
            contents: { dst: string }[];
        };

        expect(result.stdout).toBe("Show ratings");
        expect(manifest.contents.map((content) => content.dst)).toContain(
            "/usr/share/glib-2.0/schemas/org.gtkx.example.ui.gschema.xml",
        );
    });

    it("names the program after the application when a library parses options while the app loads", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0", "Gst-1.0"] });
        project.write(
            "src/player.ts",
            `import * as Gst from "@gtkx/gi/gst";
            export const isInitialized = Gst.isInitialized();`,
        );
        project.write(
            "src/index.ts",
            `import { isInitialized } from "./player.js";
            import { Application } from "@gtkx/gi/gio";
            if (!isInitialized) throw new Error("GStreamer is not initialized");
            new Application({ applicationId: "org.gtkx.example" }).run(["example", ...process.argv.slice(2)]);`,
        );

        await invoke(["build", "--cwd", project.root]);
        const result = await promisify(execFile)(process.execPath, [join(project.root, "dist/bundle.mjs"), "--help"], {
            timeout: 30_000,
        });

        expect(result.stdout).toMatch(/^Usage:\n {2}example \[/);
    });

    it("sets the program name and locale before an app's modules run, but leaves a helper's main thread to its GTKX worker", async () => {
        using project = createProject({ codegen: true, libraries: ["GLib-2.0"] });
        project.write("po/LINGUAS", "fr\n");
        project.write("po/fr.po", readFileSync(new URL("../../i18n/tests/fixtures/fr.po", import.meta.url), "utf8"));
        project.write(
            "src/probe.ts",
            `import { dgettext, getPrgname } from "@gtkx/gi/glib";
            import { t } from "@gtkx/i18n";
            export const probe = [getPrgname(), dgettext("org.gtkx.example", "Hello, {{name}}!")];
            export const translate = () => t("Hello, {{name}}!", { name: "Ada" });`,
        );
        project.write(
            "src/index.ts",
            `#!/usr/bin/env node
            import { probe, translate } from "./probe.ts";
            process.stdout.write(JSON.stringify([...probe, translate()]));`,
        );
        project.write(
            "src/cli/owner.ts",
            `import { pathGetBasename } from "@gtkx/gi/glib";
            import { quit } from "@gtkx/runtime";
            import { parentPort } from "node:worker_threads";
            const name = pathGetBasename("/photos/beach.png");
            quit();
            parentPort?.postMessage(name);`,
        );
        project.write(
            "src/cli/helper.ts",
            `import { Worker } from "node:worker_threads";
            const worker = new Worker(new URL("./owner.ts", import.meta.url));
            worker.once("message", (name) => {
                process.stdout.write(name);
                void worker.terminate();
            });`,
        );
        const run = (bundle: string) =>
            promisify(execFile)(process.execPath, [join(project.root, bundle)], {
                env: { ...process.env, LANG: "fr_FR.UTF-8", LC_ALL: "fr_FR.UTF-8", LANGUAGE: "fr" },
                timeout: 30_000,
            });

        await invoke(["build", "--cwd", project.root]);
        await invoke(["build", "src/cli/helper.ts", "--out", "dist-helper", "--cwd", project.root]);

        expect(JSON.parse((await run("dist/bundle.mjs")).stdout)).toEqual([
            "example",
            "Bonjour, {{name}} !",
            "Bonjour, Ada !",
        ]);
        expect((await run("dist-helper/bundle.mjs")).stdout).toBe("beach.png");
    });

    it("warns once about a class a production bundle dropped, unless the app references it", async () => {
        const buildEnumRow = async (itemCheck: string) => {
            const project = createProject();
            linkWorkspaceBindings(project.root);
            project.write(
                "src/index.tsx",
                `import * as Adw from "@gtkx/gi/adw";
                import * as GObject from "@gtkx/gi/gobject";
                import * as Gtk from "@gtkx/gi/gtk";
                import { AdwApplication, AdwApplicationWindow, AdwComboRow, AdwEnumListModel } from "@gtkx/jsx/adw";
                import { GtkListBox } from "@gtkx/jsx/gtk";
                import { createRoot } from "@gtkx/react";
                const name = Gtk.ClosureExpression.new(GObject.TYPE_STRING, (item: GObject.Object) => ${itemCheck}, null);
                createRoot().render(
                    <AdwApplication applicationId="org.gtkx.droppedclass">
                        <AdwApplicationWindow>
                            <GtkListBox>
                                <AdwComboRow
                                    title="Easing"
                                    model={<AdwEnumListModel enumType={Adw.Easing.__type__} />}
                                    expression={name}
                                    onMap={() => setTimeout(() => process.exit(0), 100)}
                                />
                            </GtkListBox>
                        </AdwApplicationWindow>
                    </AdwApplication>
                );`,
            );
            await invoke(["build", "--cwd", project.root]);
            return project;
        };
        using dropped = await buildEnumRow(`item.constructor.name`);
        using referenced = await buildEnumRow(`item instanceof Adw.EnumListItem ? item.getName() : ""`);
        const warnings = async (root: string) => {
            const { stderr } = await promisify(execFile)(process.execPath, [join(root, "dist/bundle.mjs")], {
                timeout: 30_000,
            });
            return stderr.split("\n").filter((line) => line.includes("Adw.EnumListItem"));
        };
        const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
        try {
            expect(await warnings(dropped.root)).toHaveLength(1);
            expect(await warnings(referenced.root)).toHaveLength(0);
        } finally {
            stopDisplay();
        }
    });

    it("tears a column view over a JavaScript list model down while JavaScript runs when the app quits", async () => {
        using project = createProject();
        linkWorkspaceBindings(project.root);
        project.write(
            "src/index.tsx",
            `import * as Gio from "@gtkx/gi/gio";
            import * as GObject from "@gtkx/gi/gobject";
            import * as Gtk from "@gtkx/gi/gtk";
            import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { GtkColumnView, GtkColumnViewColumn, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
            import { createRoot, quit } from "@gtkx/react";
            import { registerClass } from "@gtkx/runtime";
            import { useMemo } from "react";
            class NamesBase extends GObject.Object implements Gio.ListModelImpl {
                names = ["Ada", "Grace", "Linus", "Margaret", "Barbara"].map((name) => Gtk.StringObject.new(name));
                vfuncGetItemType(): bigint {
                    return Gtk.StringObject.__type__;
                }
                vfuncGetNItems(): number {
                    return this.names.length;
                }
                vfuncGetItem(position: number): GObject.Object | null {
                    return this.names[position] ?? null;
                }
                vfuncDispose(): void {
                    process.stdout.write("model disposed");
                }
            }
            const Names = registerClass(NamesBase, { typeName: "ExampleNames", implements: [Gio.ListModel] });
            const names = new Names();
            const views = new Set<Gtk.ColumnView>();
            const People = () => {
                const model = useMemo(() => Gtk.NoSelection.new(names), []);
                return (
                    <AdwApplicationWindow onMap={() => setTimeout(quit, 300)}>
                        <GtkColumnView ref={(view) => void (view && views.add(view))} model={model}>
                            <GtkColumnViewColumn
                                title="Name"
                                factory={
                                    <GtkSignalListItemFactory
                                        onSetup={(cell) => (cell as Gtk.ColumnViewCell).setChild(new Gtk.Label())}
                                        onBind={(cell) => {
                                            const { child, item } = cell as Gtk.ColumnViewCell;
                                            (child as Gtk.Label).label = (item as Gtk.StringObject).string;
                                        }}
                                    />
                                }
                            />
                        </GtkColumnView>
                    </AdwApplicationWindow>
                );
            };
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.listmodelexit">
                    <People />
                </AdwApplication>
            );`,
        );
        await invoke(["build", "--cwd", project.root]);
        const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
        try {
            const { stdout, stderr } = await promisify(execFile)(
                process.execPath,
                [join(project.root, "dist/bundle.mjs")],
                { timeout: 30_000 },
            );

            expect(stderr).not.toContain("still has children left");
            expect(stdout).toBe("model disposed");
        } finally {
            stopDisplay();
        }
    });

    it("names the library to declare when a build imports bindings the store lacks", async () => {
        using project = createProject({ codegen: true, libraries: ["GLib-2.0"] });
        project.write(
            "src/index.ts",
            `import { LanguageManager } from "@gtkx/gi/gtksource";
            LanguageManager.getDefault();`,
        );

        await expect(invoke(["build", "--cwd", project.root])).rejects.toThrow(
            'Add "GtkSource-5" to `libraries` in gtkx.config.ts',
        );
    });

    it("points a project that reuses a binding store at the project generating it for a missing library", async () => {
        using project = createProject({ libraries: ["Gst-1.0"] });
        linkWorkspaceBindings(project.root);
        project.write("src/index.ts", 'import { init } from "@gtkx/gi/gst";\ninit();');

        const message = await invoke(["build", "--cwd", project.root]).then(
            () => "",
            (error: unknown) => (error instanceof Error ? error.message : String(error)),
        );

        expect(message).toContain('Add "Gst-1.0" to `libraries` in the project that generates the binding store');
        expect(message).not.toContain("in gtkx.config.ts, then run");
    });

    it("names the package that loads a native addon a build cannot bundle, but emits addons imported with ?url", async () => {
        using project = createProject();
        const addon = "node_modules/@studio/hash-linux-x64-gnu/hash.linux-x64-gnu.node";
        project.write(
            "node_modules/@studio/hash-linux-x64-gnu/package.json",
            JSON.stringify({ name: "@studio/hash-linux-x64-gnu", version: "1.0.0", main: "hash.linux-x64-gnu.node" }),
        );
        writeFileSync(join(project.root, addon), Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0xff, 0xfe, 0x00]));
        project.write(
            "node_modules/@studio/hash/package.json",
            JSON.stringify({ name: "@studio/hash", version: "1.0.0", main: "index.js" }),
        );
        project.write("node_modules/@studio/hash/index.js", 'module.exports = require("@studio/hash-linux-x64-gnu");');
        project.write(
            "src/index.ts",
            `import addonPath from "@studio/hash-linux-x64-gnu/hash.linux-x64-gnu.node?url";
            process.stdout.write(addonPath);`,
        );

        await invoke(["build", "--cwd", project.root]);
        expect(readdirSync(join(project.root, "dist/assets")).some((name) => name.endsWith(".node"))).toBe(true);

        project.write("src/index.ts", 'import { xxh64 } from "@studio/hash";\nprocess.stdout.write(String(xxh64));');
        await expect(invoke(["build", "--cwd", project.root])).rejects.toThrow(
            /@studio\/hash loads the native addon .*hash\.linux-x64-gnu\.node.*Additional native addons.*https:\/\/gtkx\.dev\/v2\/guide\/deploying#additional-native-addons/s,
        );
    });

    it("types the asset imports a build accepts under a full library check", async () => {
        using project = createProject();
        project.write(
            "tsconfig.json",
            JSON.stringify({
                compilerOptions: {
                    module: "NodeNext",
                    strict: true,
                    skipLibCheck: false,
                    lib: ["esnext"],
                    types: ["node"],
                    noEmit: true,
                },
                include: ["src"],
            }),
        );
        project.write("src/gtkx-env.d.ts", '/// <reference types="@gtkx/cli/env" />');
        project.write(
            "src/index.ts",
            `import "./theme.css";
            import iconName from "../data/app.svg?icon";
            import fontFamily from "../data/display.ttf?font";
            import resourcePath from "../data/app.svg?resource";
            import templatePath from "../data/template.txt?url";
            import template from "../data/template.txt?raw";
            import iconData from "../data/app.svg?inline";
            import stylesheetPath from "./theme.css?url";
            const values: string[] = [iconName, fontFamily, resourcePath, templatePath, template, iconData, stylesheetPath];
            export const summary = [...values, import.meta.env.MODE, String(import.meta.hot === undefined)].join();`,
        );
        const tsc = fileURLToPath(new URL("../../../node_modules/.bin/tsc", import.meta.url));
        const typecheck = async () => {
            try {
                await promisify(execFile)(tsc, ["-p", ".", "--pretty", "false"], {
                    cwd: project.root,
                    timeout: 180_000,
                });
                return "";
            } catch (error) {
                return String((error as { stdout?: unknown }).stdout);
            }
        };
        expect(await typecheck()).toBe("");
        project.write("src/logo.ts", 'export { default } from "../data/app.svg";');
        expect(await typecheck()).toMatch(/^src\/logo\.ts\(1,25\): error TS2307: [^\n]*\n$/);
    });

    it("types GSettings schema imports, symlinked ones included, from declarations generated beside each schema", async () => {
        using project = createProject();
        const writeTsconfig = (compilerOptions: Record<string, unknown>) =>
            project.write(
                "tsconfig.json",
                JSON.stringify({
                    compilerOptions: { module: "NodeNext", strict: true, types: [], noEmit: true, ...compilerOptions },
                    include: ["src", "tests"],
                }),
            );
        const schema = (id: string) =>
            `<schemalist>
                <schema id="${id}" path="/${id.replaceAll(".", "/")}/">
                    <key name="preview" type="b"><default>true</default></key>
                </schema>
            </schemalist>`;
        const declarations = (path: string) => join(project.root, path.replace(".gschema.xml", ".gschema.d.xml.ts"));
        const tsc = fileURLToPath(new URL("../../../node_modules/.bin/tsc", import.meta.url));
        const typecheck = async () => {
            try {
                await promisify(execFile)(tsc, ["-p", ".", "--pretty", "false"], {
                    cwd: project.root,
                    timeout: 180_000,
                });
                return "";
            } catch (error) {
                return String((error as { stdout?: unknown }).stdout);
            }
        };
        writeTsconfig({ allowArbitraryExtensions: true });
        project.write("data/org.gtkx.example.gschema.xml", schema("org.gtkx.example"));
        project.write("tests/fixtures/org.gtkx.example.gschema.xml", schema("org.gtkx.example.fixture"));
        project.write("data/retired/org.gtkx.retired.gschema.xml", schema("org.gtkx.retired"));
        project.write("data/retired/org.gtkx.custom.gschema.d.xml.ts", "export {};\n");
        project.write("shared/org.gtkx.linked.gschema.xml", schema("org.gtkx.linked"));
        symlinkSync("../shared/org.gtkx.linked.gschema.xml", join(project.root, "data/org.gtkx.linked.gschema.xml"));
        project.write(
            "src/linked.ts",
            `import schema from "../data/org.gtkx.linked.gschema.xml";
            export const id: "org.gtkx.linked" = schema.id;`,
        );
        project.write(
            "src/index.ts",
            `import schema from "../data/org.gtkx.example.gschema.xml";
            export const id: "org.gtkx.example" = schema.id;
            export const preview: "b" = schema.keys.preview;`,
        );
        project.write(
            "tests/fixture.ts",
            `import schema from "./fixtures/org.gtkx.example.gschema.xml";
            export const id: "org.gtkx.example.fixture" = schema.id;`,
        );

        expect(await invoke(["codegen", "--cwd", project.root])).not.toContain("allowArbitraryExtensions");
        expect(existsSync(declarations("data/retired/org.gtkx.retired.gschema.xml"))).toBe(true);
        expect(await typecheck()).toBe("");

        project.write("src/typo.ts", 'export { default } from "../dta/org.gtkx.example.gschema.xml";');
        expect(await typecheck()).toMatch(/^src\/typo\.ts\(1,25\): error TS2307: [^\n]*\n$/);

        unlinkSync(join(project.root, "src/typo.ts"));
        unlinkSync(join(project.root, "data/retired/org.gtkx.retired.gschema.xml"));
        writeTsconfig({});
        expect(await invoke(["codegen", "--cwd", project.root])).toContain("allowArbitraryExtensions");
        expect(existsSync(declarations("data/retired/org.gtkx.retired.gschema.xml"))).toBe(false);
        expect(existsSync(join(project.root, "data/retired/org.gtkx.custom.gschema.d.xml.ts"))).toBe(true);
        expect(existsSync(declarations("data/org.gtkx.example.gschema.xml"))).toBe(true);
    });

    it("types identical copies of a GSettings schema and rejects differing copies", async () => {
        using project = createProject();
        project.write(
            "tsconfig.json",
            JSON.stringify({
                compilerOptions: {
                    module: "NodeNext",
                    strict: true,
                    skipLibCheck: false,
                    allowArbitraryExtensions: true,
                    types: [],
                    noEmit: true,
                },
                include: ["src"],
            }),
        );
        const schema = (key: string) =>
            `<schemalist>
                <schema id="org.gtkx.example" path="/org/gtkx/example/">
                    <key name="${key}" type="b"><default>true</default></key>
                </schema>
            </schemalist>`;
        for (const chapter of ["editor", "viewer", "linked"]) {
            project.write(
                `src/${chapter}/settings.ts`,
                `import schema from "./data/org.gtkx.example.gschema.xml";\nexport const id: "org.gtkx.example" = schema.id;`,
            );
        }
        project.write("src/editor/data/org.gtkx.example.gschema.xml", schema("preview"));
        project.write("src/viewer/data/org.gtkx.example.gschema.xml", schema("preview"));
        symlinkSync("../editor/data", join(project.root, "src/linked/data"), "dir");
        const tsc = fileURLToPath(new URL("../../../node_modules/.bin/tsc", import.meta.url));

        await invoke(["codegen", "--cwd", project.root]);
        await promisify(execFile)(tsc, ["-p", "."], { cwd: project.root, timeout: 180_000 });

        project.write("src/viewer/data/org.gtkx.example.gschema.xml", schema("sidebar"));
        await expect(invoke(["codegen", "--cwd", project.root])).rejects.toThrow();
    });

    it("bundles stylesheets imported with ?resource, warning about unbundled url() targets, while a slower Vite plugin resolves another import", async () => {
        using project = createProject();
        linkWorkspaceBindings(project.root);
        for (const name of ["base", "dark"]) {
            project.write(`data/${name}.css`, `.${name} { color: red; }`);
        }
        project.write(
            "data/style.css",
            `@import url("base.css");
            .style { color: red; background-image: url("missing.png"); }`,
        );
        project.write(
            "vite.config.ts",
            `export default {
                plugins: [{
                    name: "slow-resolve",
                    enforce: "pre",
                    async resolveId(source) {
                        if (source.includes("/style.css") && !source.includes("?resource")) {
                            await new Promise((resolve) => setTimeout(resolve, 500));
                        }
                        return null;
                    },
                }],
            };`,
        );
        project.write("src/dark.ts", 'export { default } from "../data/dark.css?resource";');
        project.write(
            "src/index.ts",
            `import base from "../data/base.css?resource";
            import style from "../data/style.css?resource";
            import dark from "./dark.ts";
            export const paths = [base, style, dark];`,
        );

        const output = await invoke(["build", "--cwd", project.root]);

        expect(readFileSync(join(project.root, "dist/bundle.mjs"), "utf8")).toContain(
            "/org/gtkx/example/data/style.css",
        );
        expect(output.split("\n").filter((line) => line.includes("/org/gtkx/example/data/"))).toEqual([
            expect.stringContaining("/org/gtkx/example/data/missing.png"),
        ]);
    });
});
