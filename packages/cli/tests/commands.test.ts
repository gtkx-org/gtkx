import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "@gtkx/mcp/server";
import { resolveHeadlessOptions, startHeadlessDisplay } from "@gtkx/vitest/headless";
import { runCommand } from "citty";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempDisposableSync,
    readFileSync,
    readdirSync,
    realpathSync,
    renameSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { format } from "oxfmt";
import { stdout, stderr } from "test-console";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVitest } from "vitest/node";
import { parse } from "yaml";
import { createCommand } from "../dist/command.js";
import { createPnpmWorkspace, createProject, linkWorkspaceBindings } from "./project.js";

const MAX_BUNDLE_LINE_LENGTH = 500;

const invoke = async (args: string[], selected = createCommand()) => {
    let output = "";
    let errors = "";
    await stderr.inspectAsync(async (chunks) => {
        await stdout.inspectAsync(async (messages) => {
            await runCommand(selected, { rawArgs: args });
            output = messages.join("");
        });
        errors = chunks.join("");
    });
    return output + errors;
};

const withSession = async (
    name: string,
    root: string,
    readyPath: string,
    verify: () => Promise<void>,
    args: string[] = [],
    applicationArgs: string[] = [],
) => {
    const controller = new AbortController();
    const running = invoke(
        [name, "--cwd", root, "--headless", "--size", "640x480", ...args],
        createCommand({ signal: controller.signal, applicationArgs }),
    );
    let output: string;
    try {
        await Promise.race([
            expect.poll(() => existsSync(readyPath), { timeout: 60_000 }).toBe(true),
            running.then(() => {
                throw new Error("Session ended before loading the application");
            }),
        ]);
        await verify();
    } finally {
        controller.abort();
        output = await running;
    }

    return output;
};

const withMcpClient = async (root: string, run: (client: Client) => Promise<void>) => {
    const socketPath = join(root, "mcp.sock");
    vi.stubEnv("GTKX_MCP_SOCKET_PATH", socketPath);
    const [clientTransport, transport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer({ transport, socketPath, version: "1.0.0", cwd: root });
    const client = new Client({ name: "cli-test", version: "1.0.0" });
    try {
        await server.start();
        await client.connect(clientTransport);
        await run(client);
    } finally {
        await client.close();
        await server.stop();
    }
};

const callTool = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
    const result = CallToolResultSchema.parse(await client.callTool({ name, arguments: args }));
    const text = result.content.map((content) => (content.type === "text" ? content.text : "")).join("\n");
    return { isError: result.isError === true, text };
};

const writeWidgetApp = (project: ReturnType<typeof createProject>, readyPath: string, content: string) => {
    linkWorkspaceBindings(project.root);
    project.write("src/content.tsx", content);
    project.write(
        "src/index.tsx",
        `import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
        import { createRoot } from "@gtkx/react";
        import { writeFileSync } from "node:fs";
        import { useEffect } from "react";
        import { Content } from "./content.tsx";
        const Ready = () => {
            useEffect(() => writeFileSync(${JSON.stringify(readyPath)}, "ready"), []);
            return null;
        };
        createRoot().render(
            <AdwApplication applicationId="org.gtkx.example">
                <AdwApplicationWindow><Ready /><Content /></AdwApplicationWindow>
            </AdwApplication>
        );`,
    );
};

const queryWidgets = async (client: Client, query: Record<string, unknown>) => {
    const { text } = await callTool(client, "gtkx_query_widgets", query);
    return (JSON.parse(text) as { widgets: { id: string; type: string; name: string | null }[] }).widgets;
};

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("CLI commands", () => {
    it("builds a project and protects files outside the requested output directory", async () => {
        using project = createProject();
        const output = await invoke(["build", "--cwd", project.root]);
        expect(output).toContain("Build complete");
        expect(readFileSync(join(project.root, "dist/bundle.mjs"), "utf8")).toContain("hello from build");
        project.write("keep.txt", "keep");
        await expect(invoke(["build", "--cwd", project.root, "--out", "../outside"])).rejects.toThrow();
        expect(readFileSync(join(project.root, "keep.txt"), "utf8")).toBe("keep");
    });

    it("rejects arguments after -- for commands that start no application", async () => {
        using project = createProject();

        await expect(
            invoke(["build", "--cwd", project.root], createCommand({ applicationArgs: ["--out", "build/helper"] })),
        ).rejects.toThrow();
        expect(existsSync(join(project.root, "dist"))).toBe(false);
    });

    it("points a document passed as the entry to application arguments", async () => {
        using project = createProject();
        project.write("COMMIT_EDITMSG", "# Please enter the commit message\n");

        await expect(invoke(["dev", "--cwd", project.root, "COMMIT_EDITMSG"])).rejects.toThrow(
            "gtkx dev -- COMMIT_EDITMSG",
        );
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
            /@studio\/hash loads the native addon .*hash\.linux-x64-gnu\.node.*Additional native addons/s,
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

    it("applies imported CSS with its relative imports and images in development and production", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "style.json");
        project.write(
            "data/probe.png",
            Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAABmJLR0QA/wD/AP+gvaeTAAAAFklEQVQImWPkOiHHwMDAxMDAwMDAAAALVgD0RY0W+wAAAABJRU5ErkJggg==",
                "base64",
            ),
        );
        project.write("src/styles/base.css", ".cli-css-base { min-height: 47px; }");
        project.write(
            "src/styles/theme.css",
            `@import url("./base.css");
            @define-color cli_css_probe rgb(3, 6, 9);
            .cli-css-probe { color: @cli_css_probe; min-width: 231px; background-image: url("../../data/probe.png"); }`,
        );
        project.write(
            "src/index.tsx",
            `import "./styles/theme.css";
            import * as Gdk from "@gtkx/gi/gdk";
            import * as Graphene from "@gtkx/gi/graphene";
            import * as Gsk from "@gtkx/gi/gsk";
            import * as Gtk from "@gtkx/gi/gtk";
            import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { GtkLabel } from "@gtkx/jsx/gtk";
            import { createRoot } from "@gtkx/react";
            import { writeFileSync } from "node:fs";
            const cornerPixel = (label: Gtk.Label) => {
                const snapshot = new Gtk.Snapshot();
                new Gtk.WidgetPaintable({ widget: label }).snapshot(snapshot, label.getWidth(), label.getHeight());
                const renderer = new Gsk.CairoRenderer();
                renderer.realizeForDisplay(label.getDisplay());
                const texture = renderer.renderTexture(snapshot.toNode(), Graphene.Rect.alloc().init(0, 0, 2, 2));
                renderer.unrealize();
                const downloader = Gdk.TextureDownloader.new(texture);
                downloader.setFormat(Gdk.MemoryFormat.R8G8B8A8);
                return [...(downloader.downloadBytes()[0].getData() ?? []).slice(0, 4)];
            };
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.cssprobe">
                    <AdwApplicationWindow>
                        <GtkLabel label="Probe" valign={Gtk.Align.START} cssClasses={["cli-css-probe", "cli-css-base"]} onMap={(label) => {
                            setTimeout(() => {
                                const [width] = label.measure(Gtk.Orientation.HORIZONTAL, -1);
                                const [height] = label.measure(Gtk.Orientation.VERTICAL, -1);
                                writeFileSync(${JSON.stringify(readyPath)}, JSON.stringify({ width, height, pixel: cornerPixel(label) }));
                                if (process.env.NODE_ENV === "production") process.exit(0);
                            }, 100);
                        }} />
                    </AdwApplicationWindow>
                </AdwApplication>
            );`,
        );
        const style = () => JSON.parse(readFileSync(readyPath, "utf8")) as unknown;
        const expected = { width: 231, height: 47, pixel: [10, 200, 30, 255] };
        await withSession("dev", project.root, readyPath, async () => {
            await expect.poll(style, { timeout: 30_000 }).toEqual(expected);
        });
        rmSync(readyPath);
        await invoke(["build", "--cwd", project.root]);
        const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
        try {
            await promisify(execFile)(process.execPath, [join(project.root, "dist/bundle.mjs")], { timeout: 30_000 });
            expect(style()).toEqual(expected);
            expect(
                readdirSync(join(project.root, "dist"), { recursive: true }).some((file) =>
                    String(file).endsWith(".css"),
                ),
            ).toBe(false);
        } finally {
            stopDisplay();
        }
    });

    it("runs workers with asset imports in development, tests and production and restarts for their edits", async () => {
        using project = createProject();
        using shared = mkdtempDisposableSync(join(tmpdir(), "gtkx-cli-shared-"));
        const readyPath = join(project.root, "worker.json");
        const sourcePath = join(project.root, "data/notes.txt");
        const sharedPath = join(shared.path, "index.ts");
        const workerSource = `import { readFileSync } from "node:fs";
            import { parentPort } from "node:worker_threads";
            import { label } from "@example/shared";
            import notesPath from "../../data/notes.txt?url";
            import notes from "../../data/notes.txt?raw";
            import notesData from "../../data/notes.txt?inline";
            parentPort?.postMessage({ path: notesPath, text: readFileSync(notesPath, "utf8"), raw: notes, inline: notesData, label });`;
        writeFileSync(
            join(shared.path, "package.json"),
            JSON.stringify({ name: "@example/shared", type: "module", exports: "./index.ts" }),
        );
        writeFileSync(sharedPath, 'export const label = "shared";');
        mkdirSync(join(project.root, "node_modules/@example"));
        symlinkSync(shared.path, join(project.root, "node_modules/@example/shared"), "dir");
        project.write("data/notes.txt", "worker asset");
        project.write("src/workers/read.ts", workerSource);
        project.write(
            "src/index.ts",
            `import { writeFileSync } from "node:fs";
            import { Worker } from "node:worker_threads";
            const worker = new Worker(new URL("./workers/read.ts", import.meta.url));
            worker.once("message", (result) => writeFileSync(${JSON.stringify(readyPath)}, JSON.stringify(result)));
            worker.once("error", (error) => writeFileSync(${JSON.stringify(readyPath)}, JSON.stringify({ error: String(error) })));`,
        );
        project.write(
            "tests/worker.test.ts",
            `import { fileURLToPath } from "node:url";
            import { Worker } from "node:worker_threads";
            import { expect, test } from "vitest";
            test("reads an asset URL in a worker", async () => {
                const worker = new Worker(new URL("../src/workers/read.ts", import.meta.url));
                const result = await new Promise((resolve, reject) => {
                    worker.once("message", resolve);
                    worker.once("error", reject);
                });
                expect(result).toEqual({
                    path: fileURLToPath(new URL("../data/notes.txt", import.meta.url)),
                    text: "worker asset",
                    raw: "worker asset",
                    inline: "data:text/plain;base64,d29ya2VyIGFzc2V0",
                    label: "shared",
                });
            });`,
        );
        project.write(
            "vitest.config.mjs",
            `import gtkx from "@gtkx/cli/vitest-plugin";
            export default { plugins: [gtkx()], test: { include: ["tests/*.test.ts"] } };`,
        );
        const result = () => JSON.parse(readFileSync(readyPath, "utf8")) as Record<string, string>;

        await withSession("dev", project.root, readyPath, async () => {
            await expect.poll(result).toEqual({
                path: sourcePath,
                text: "worker asset",
                raw: "worker asset",
                inline: "data:text/plain;base64,d29ya2VyIGFzc2V0",
                label: "shared",
            });
            project.write("data/notes.txt", "edited asset");
            await expect.poll(result, { timeout: 30_000 }).toEqual({
                path: sourcePath,
                text: "edited asset",
                raw: "edited asset",
                inline: "data:text/plain;base64,ZWRpdGVkIGFzc2V0",
                label: "shared",
            });
            project.write("data/notes.txt", "worker asset");
            await expect.poll(result, { timeout: 30_000 }).toMatchObject({ raw: "worker asset" });
            writeFileSync(sharedPath, 'export const label = "edited shared";');
            await expect.poll(result, { timeout: 30_000 }).toMatchObject({ label: "edited shared" });
            writeFileSync(sharedPath, 'export const label = "shared";');
            await expect.poll(result, { timeout: 30_000 }).toMatchObject({ label: "shared" });
            rmSync(readyPath);
            project.write("src/workers/read.ts", workerSource);
            await expect.poll(() => existsSync(readyPath), { timeout: 30_000 }).toBe(true);
        });
        const runner = await createVitest({
            root: project.root,
            config: join(project.root, "vitest.config.mjs"),
            watch: false,
            reporters: [],
        });
        try {
            const results = await runner.start();
            expect(results.testModules.map((module) => module.state())).toEqual(["passed"]);
        } finally {
            await runner.close();
        }
        rmSync(readyPath);
        await invoke(["build", "--cwd", project.root]);
        await promisify(execFile)(process.execPath, [join(project.root, "dist/bundle.mjs")], { timeout: 30_000 });
        expect(result().text).toBe("worker asset");
        expect(result().raw).toBe("worker asset");
        expect(result().inline).toBe("data:text/plain;base64,d29ya2VyIGFzc2V0");
        expect(result().label).toBe("shared");
        expect(result().path).toMatch(new RegExp(`^${RegExp.escape(join(project.root, "dist"))}/`));
    });

    it("refreshes component state and restarts for import and bundled asset changes", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "resources.json");
        const failedPath = join(project.root, "load-failed.txt");
        const icon = (color: string) =>
            `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="${color}"/></svg>`;
        project.write("src/a.txt", "first");
        project.write("src/b.json", "second");
        project.write("src/probe.svg", icon("blue"));
        project.write("src/notes.txt", "notes");
        project.write("src/theme.css", "label { color: red; }");
        project.write(
            "src/data-a.ts",
            `import value from "./a.txt?resource=/org/gtkx/probe/value";
            export { value as path };`,
        );
        project.write("src/data-b.ts", `export { default as path } from "./b.json?resource=/org/gtkx/probe/value";`);
        const component = (label: string, data: string) => `
            import { Display } from "@gtkx/gi/gdk";
            import { resourcesLookupData } from "@gtkx/gi/gio";
            import { IconTheme } from "@gtkx/gi/gtk";
            import { GtkLabel } from "@gtkx/jsx/gtk";
            import { randomUUID } from "node:crypto";
            import { writeFileSync } from "node:fs";
            import { useEffect, useState } from "react";
            import { path } from "./data-${data}.ts";
            import iconName from "./probe.svg?icon=gtkx-resource-probe";
            import notesPath from "./notes.txt?resource";
            import themePath from "./theme.css?resource";
            export function Probe() {
                const [token] = useState(() => randomUUID());
                const label = ${JSON.stringify(label)};
                useEffect(() => {
                    const display = Display.getDefault();
                    if (display === null) throw new Error("No display");
                    const text = (resource) => new TextDecoder().decode(resourcesLookupData(resource, 0).getData());
                    writeFileSync(${JSON.stringify(readyPath)}, JSON.stringify({
                        pid: process.pid,
                        token,
                        label,
                        value: text(path),
                        hasIcon: IconTheme.getForDisplay(display).hasIcon(iconName),
                        icon: text("/org/gtkx/example/icons/gtkx-resource-probe.svg"),
                        notes: text(notesPath),
                        theme: text(themePath),
                    }));
                    if (process.env.NODE_ENV === "production") process.exit(0);
                }, [label, token]);
                return <GtkLabel label={label} />;
            }
        `;
        project.write("src/probe.tsx", component("initial", "a"));
        project.write(
            "src/index.tsx",
            `import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { createRoot } from "@gtkx/react";
            import { writeFileSync } from "node:fs";
            const { Probe } = await import("./probe.tsx").catch((cause) => {
                writeFileSync(${JSON.stringify(failedPath)}, String(process.pid));
                throw cause;
            });
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.example">
                    <AdwApplicationWindow><Probe /></AdwApplicationWindow>
                </AdwApplication>
            );`,
        );
        const observation = () =>
            JSON.parse(readFileSync(readyPath, "utf8")) as {
                pid: number;
                token: string;
                label: string;
                value: string;
                hasIcon: boolean;
                icon: string;
                notes: string;
                theme: string;
            };
        await withSession("dev", project.root, readyPath, async () => {
            const initial = observation();
            expect(initial).toMatchObject({
                label: "initial",
                value: "first",
                hasIcon: true,
                icon: icon("blue"),
                notes: "notes",
                theme: "label { color: red; }",
            });
            project.write("src/probe.tsx", component("refreshed", "a"));
            await expect.poll(() => observation().label, { timeout: 30_000 }).toBe("refreshed");
            expect(observation()).toMatchObject({ pid: initial.pid, token: initial.token, value: "first" });

            project.write("src/probe.tsx", component("replaced", "b"));
            await expect.poll(() => observation().value, { timeout: 30_000 }).toBe("second");
            const replaced = observation();
            expect(replaced.pid).not.toBe(initial.pid);
            expect(replaced.token).not.toBe(initial.token);

            project.write("src/b.json", "updated");
            await expect.poll(() => observation().value, { timeout: 30_000 }).toBe("updated");
            const updated = observation();
            expect(updated.pid).not.toBe(replaced.pid);

            project.write("src/probe.svg", icon("red"));
            await expect.poll(() => observation().icon, { timeout: 30_000 }).toBe(icon("red"));
            expect(observation()).toMatchObject({ hasIcon: true, value: "updated" });
            expect(observation().pid).not.toBe(updated.pid);

            const beforeRemoval = observation();
            rmSync(join(project.root, "src/b.json"));
            await expect.poll(() => existsSync(failedPath), { timeout: 30_000 }).toBe(true);
            project.write("src/b.json", "recovered");
            await expect.poll(() => observation().value, { timeout: 30_000 }).toBe("recovered");
            expect(observation().pid).not.toBe(beforeRemoval.pid);
        });
        rmSync(readyPath);
        await invoke(["build", "--cwd", project.root]);
        const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
        try {
            await promisify(execFile)(process.execPath, [join(project.root, "dist/bundle.mjs")], { timeout: 30_000 });
            expect(observation()).toMatchObject({
                label: "replaced",
                value: "recovered",
                hasIcon: true,
                icon: icon("red"),
                notes: "notes",
                theme: "label { color: red; }",
            });
        } finally {
            stopDisplay();
        }
    });

    it("refreshes components through the non-component modules they import", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "probe.json");
        const hook = (label: string, hasExtraState = false) => `
            import { randomUUID } from "node:crypto";
            import { useState } from "react";
            export const useProbe = () => {
                const [token] = useState(() => randomUUID());
                ${hasExtraState ? "useState(0);" : ""}
                return { token, label: ${JSON.stringify(label)} };
            };
        `;
        project.write("src/use-probe.ts", hook("first"));
        project.write("src/suffix.ts", 'export const suffix = "x";');
        project.write("src/format.ts", 'import { suffix } from "./suffix.ts"; export const format = () => suffix;');
        project.write("src/title.ts", 'export const title = "a";');
        project.write("src/greeting.glsl", "hello");
        const badge = (text: string) => `
            import { Label } from "@gtkx/gi/gtk";
            import { registerClass } from "@gtkx/runtime";
            class BadgeBase extends Label {}
            export const Badge = registerClass(BadgeBase, { typeName: "ProbeBadge" });
            export const badgeText = ${JSON.stringify(text)};
        `;
        project.write("src/badge.ts", badge("one"));
        project.write(
            "src/probe.tsx",
            `import { GtkLabel } from "@gtkx/jsx/gtk";
            import { writeFileSync } from "node:fs";
            import { useEffect } from "react";
            import { badgeText } from "./badge.ts";
            import { format } from "./format.ts";
            import greeting from "./greeting.glsl?raw";
            import { title } from "./title.ts";
            import { useProbe } from "./use-probe.ts";
            export function Probe() {
                const { token, label } = useProbe();
                const suffix = format();
                useEffect(() => {
                    writeFileSync(${JSON.stringify(readyPath)}, JSON.stringify({ pid: process.pid, token, label, suffix, title, greeting, badgeText }));
                }, [token, label, suffix, greeting]);
                return <GtkLabel label={label + suffix} />;
            }`,
        );
        project.write(
            "src/index.tsx",
            `import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { createRoot } from "@gtkx/react";
            import { Probe } from "./probe.tsx";
            import { title } from "./title.ts";
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.example">
                    <AdwApplicationWindow title={title}><Probe /></AdwApplicationWindow>
                </AdwApplication>
            );`,
        );
        const observation = () =>
            JSON.parse(readFileSync(readyPath, "utf8")) as {
                pid: number;
                token: string;
                label: string;
                suffix: string;
                title: string;
                greeting: string;
                badgeText: string;
            };
        await withSession("dev", project.root, readyPath, async () => {
            const initial = observation();
            expect(initial).toMatchObject({
                label: "first",
                suffix: "x",
                title: "a",
                greeting: "hello",
                badgeText: "one",
            });

            project.write("src/greeting.glsl", "hello again");
            await expect.poll(() => observation().greeting, { timeout: 30_000 }).toBe("hello again");
            expect(observation()).toMatchObject({ pid: initial.pid, token: initial.token });

            project.write("src/use-probe.ts", hook("second"));
            await expect.poll(() => observation().label, { timeout: 30_000 }).toBe("second");
            expect(observation()).toMatchObject({ pid: initial.pid, token: initial.token });

            project.write("src/suffix.ts", 'export const suffix = "y";');
            await expect.poll(() => observation().suffix, { timeout: 30_000 }).toBe("y");
            expect(observation()).toMatchObject({ pid: initial.pid, token: initial.token, label: "second" });

            project.write("src/use-probe.ts", hook("third", true));
            await expect.poll(() => observation().label, { timeout: 30_000 }).toBe("third");
            const remounted = observation();
            expect(remounted.pid).toBe(initial.pid);
            expect(remounted.token).not.toBe(initial.token);

            project.write("src/title.ts", 'export const title = "b";');
            await expect.poll(() => observation().title, { timeout: 30_000 }).toBe("b");
            const restarted = observation();
            expect(restarted.pid).not.toBe(initial.pid);

            project.write("src/badge.ts", badge("two"));
            await expect.poll(() => observation().badgeText, { timeout: 30_000 }).toBe("two");
            const registered = observation();
            expect(registered.pid).not.toBe(restarted.pid);

            project.write("src/use-probe.ts", hook("fourth", true));
            await expect.poll(() => observation().label, { timeout: 30_000 }).toBe("fourth");
            expect(observation()).toMatchObject({ pid: registered.pid, token: registered.token, badgeText: "two" });
        });
    });

    it("brings the application back when Fast Refresh remounts it", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "probe.json");
        const app = (version: number) => `
            import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { GtkLabel } from "@gtkx/jsx/gtk";
            import { writeFileSync } from "node:fs";
            import { useEffect, useState } from "react";
            function Probe() {
                useEffect(() => {
                    writeFileSync(${JSON.stringify(readyPath)}, JSON.stringify({ version: ${String(version)} }));
                }, []);
                return <GtkLabel label="probe" />;
            }
            export function App() {
                ${"useState(0);".repeat(version)}
                return (
                    <AdwApplication applicationId="org.gtkx.example">
                        <AdwApplicationWindow><Probe /></AdwApplicationWindow>
                    </AdwApplication>
                );
            }`;
        project.write("src/app.tsx", app(1));
        project.write(
            "src/index.tsx",
            `import { createRoot } from "@gtkx/react";
            import { App } from "./app.tsx";
            createRoot().render(<App />);`,
        );
        const observation = () => JSON.parse(readFileSync(readyPath, "utf8")) as { version: number };
        await withSession("dev", project.root, readyPath, async () => {
            expect(observation().version).toBe(1);
            project.write("src/app.tsx", app(2));
            await expect.poll(() => observation().version, { timeout: 30_000 }).toBe(2);
        });
    });

    it("renders elements from an installed package built against @gtkx/react in development and tests", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "kit.txt");
        project.write(
            "package.json",
            JSON.stringify({ name: "cli-example", version: "1.0.0", type: "module", dependencies: { kit: "*" } }),
        );
        project.write(
            "node_modules/kit/package.json",
            JSON.stringify({
                name: "kit",
                type: "module",
                exports: "./index.js",
                peerDependencies: { "@gtkx/react": "*" },
            }),
        );
        project.write(
            "node_modules/kit/index.js",
            `import { GtkLabel } from "@gtkx/jsx/gtk";
            import { jsx } from "react/jsx-runtime";
            export const Badge = (props) => jsx(GtkLabel, props);`,
        );
        project.write(
            "src/index.tsx",
            `import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { createRoot } from "@gtkx/react";
            import { Badge } from "kit";
            import { writeFileSync } from "node:fs";
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.example">
                    <AdwApplicationWindow>
                        <Badge label="kit" onMap={(label) => writeFileSync(${JSON.stringify(readyPath)}, label.getLabel())} />
                    </AdwApplicationWindow>
                </AdwApplication>
            );`,
        );
        await withSession("dev", project.root, readyPath, async () => {
            await expect.poll(() => readFileSync(readyPath, "utf8")).toBe("kit");
        });
        project.write(
            "tests/badge.test.tsx",
            `import { render, screen } from "@gtkx/testing";
            import { Badge } from "kit";
            import { expect, test } from "vitest";
            test("renders the kit badge", async () => {
                await render(<Badge label="kit" />);
                expect(await screen.findByText("kit")).toBeTruthy();
            });`,
        );
        project.write(
            "vitest.config.mjs",
            `import gtkx from "@gtkx/cli/vitest-plugin";
            export default { plugins: [gtkx()], test: { include: ["tests/*.test.tsx"] } };`,
        );
        const runner = await createVitest({
            root: project.root,
            config: join(project.root, "vitest.config.mjs"),
            watch: false,
            reporters: [],
        });
        try {
            const results = await runner.start();
            expect(results.testModules.map((module) => module.state())).toEqual(["passed"]);
        } finally {
            await runner.close();
        }
    });

    it("runs apps of an isolated pnpm workspace that bind different libraries", { timeout: 900_000 }, async () => {
        using workspace = createPnpmWorkspace({
            journal: { applicationId: "org.gtkx.journal", codegen: true },
            editor: { applicationId: "org.gtkx.editor", codegen: true, libraries: ["GtkSource-5"] },
        });
        const strippedEnv = new Set(["DISPLAY", "NODE_ENV", "NODE_PATH"]);
        const childEnv = () =>
            Object.fromEntries(
                Object.entries(process.env).filter(([name]) => !name.startsWith("VITEST") && !strippedEnv.has(name)),
            );
        const appDir = (app: string) => join(workspace.root, "apps", app);
        const readyPath = (app: string) => join(appDir(app), "ready.txt");
        workspace.write(
            "packages/ui/package.json",
            JSON.stringify({
                name: "@studio/ui",
                type: "module",
                exports: "./index.js",
                peerDependencies: { "@gtkx/react": "*" },
            }),
        );
        workspace.write(
            "packages/ui/index.js",
            `import { GtkLabel } from "@gtkx/jsx/gtk";
            import { jsx } from "react/jsx-runtime";
            export const Badge = (props) => jsx(GtkLabel, props);`,
        );
        workspace.write(
            "packages/ui/index.d.ts",
            `import type { GtkLabelProps } from "@gtkx/jsx/gtk";
            import type { ReactNode } from "react";
            export declare const Badge: (props: GtkLabelProps) => ReactNode;`,
        );
        workspace.linkApp("packages/ui");
        for (const app of ["journal", "editor"]) {
            mkdirSync(join(appDir(app), "node_modules/@studio"), { recursive: true });
            symlinkSync(join(workspace.root, "packages/ui"), join(appDir(app), "node_modules/@studio/ui"), "dir");
            workspace.write(
                `apps/${app}/package.json`,
                JSON.stringify({ name: app, type: "module", dependencies: { "@studio/ui": "workspace:*" } }),
            );
            workspace.write(
                `apps/${app}/tsconfig.json`,
                JSON.stringify({
                    compilerOptions: {
                        module: "NodeNext",
                        jsx: "react-jsx",
                        strict: true,
                        skipLibCheck: true,
                        noEmit: true,
                        types: ["node", "react"],
                    },
                    include: ["src"],
                }),
            );
            workspace.write(
                `apps/${app}/vitest.config.mjs`,
                `import gtkx from "@gtkx/cli/vitest-plugin";
                export default { plugins: [gtkx()], test: { include: ["tests/*.test.tsx"] } };`,
            );
        }
        const writeApp = (app: string, label: string, imports = "") => {
            workspace.write(
                `apps/${app}/src/index.tsx`,
                `${imports}
                import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
                import { createRoot } from "@gtkx/react";
                import { Badge } from "@studio/ui";
                import { writeFileSync } from "node:fs";
                createRoot().render(
                    <AdwApplication applicationId="org.gtkx.${app}">
                        <AdwApplicationWindow>
                            <Badge label={${label}} onMap={(badge) => {
                                writeFileSync(${JSON.stringify(readyPath(app))}, badge.getLabel());
                                if (process.env.NODE_ENV === "production") process.exit(0);
                            }} />
                        </AdwApplicationWindow>
                    </AdwApplication>
                );`,
            );
        };
        writeApp("journal", '"journal"');
        writeApp(
            "editor",
            'new GtkSource.Buffer().getLanguage() === null ? "editor" : "language"',
            'import * as GtkSource from "@gtkx/gi/gtksource";',
        );
        workspace.write("apps/editor/node_modules/.gtkx/gi/package.json", '{"name":"@gtkx/gi","exports":{}}');
        symlinkSync("../.gtkx/gi", join(appDir("editor"), "node_modules/@gtkx/gi"), "dir");
        const sourceTest = `import * as GtkSource from "@gtkx/gi/gtksource";
            import { render, screen } from "@gtkx/testing";
            import { Badge } from "@studio/ui";
            import { expect, test } from "vitest";
            test("renders the shared badge next to source bindings", async () => {
                await render(<Badge label="shared" />);
                expect(await screen.findByText("shared")).toBeTruthy();
                expect(new GtkSource.Buffer().getLanguage()).toBeNull();
            });`;
        workspace.write("apps/editor/tests/badge.test.tsx", sourceTest);
        workspace.write("apps/journal/tests/badge.test.tsx", sourceTest);
        const run = (app: string, args: string[], timeout = 180_000) =>
            promisify(execFile)(process.execPath, args, {
                cwd: appDir(app),
                env: childEnv(),
                timeout,
                killSignal: "SIGKILL",
            });
        const typecheck = (app: string) =>
            promisify(execFile)(workspace.tsc, ["-p", appDir(app)], { env: childEnv(), timeout: 180_000 });
        const resolveModule = async (directory: string, specifier: string) => {
            const { stdout } = await promisify(execFile)(
                process.execPath,
                ["--input-type=module", "-e", `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`],
                { cwd: directory, env: childEnv(), timeout: 60_000 },
            );
            return realpathSync(fileURLToPath(stdout.trim()));
        };

        await run("editor", [workspace.cli("editor"), "codegen"]);
        await typecheck("editor");

        writeApp("journal", "String(GtkSource.Buffer)", 'import * as GtkSource from "@gtkx/gi/gtksource";');
        await run("journal", [workspace.cli("journal"), "codegen"]);
        await expect(typecheck("journal")).rejects.toThrow();
        await expect(resolveModule(appDir("journal"), "@gtkx/gi/gtksource")).rejects.toThrow();
        await expect(run("journal", [workspace.cli("journal"), "build"])).rejects.toThrow();
        await expect(
            run("journal", [join(appDir("journal"), "node_modules/vitest/vitest.mjs"), "run"]),
        ).rejects.toThrow();
        expect(await resolveModule(appDir("journal"), "@gtkx/gi/gtk")).toBe(
            await resolveModule(workspace.root, "@gtkx/gi/gtk"),
        );
        expect(await resolveModule(appDir("editor"), "@gtkx/gi/gtksource")).toBe(
            await resolveModule(workspace.root, "@gtkx/gi/gtksource"),
        );
        writeApp("journal", '"journal"');
        rmSync(join(appDir("journal"), "tests"), { recursive: true });
        await typecheck("journal");

        await run("journal", [workspace.cli("journal"), "build"]);
        await run("editor", [workspace.cli("editor"), "build"]);
        await run("editor", [join(appDir("editor"), "node_modules/vitest/vitest.mjs"), "run"]);

        const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
        try {
            for (const app of ["journal", "editor"]) {
                await run(app, [join(appDir(app), "dist/bundle.mjs")], 60_000);
            }
        } finally {
            stopDisplay();
        }
        expect(readFileSync(readyPath("journal"), "utf8")).toBe("journal");
        expect(readFileSync(readyPath("editor"), "utf8")).toBe("editor");

        rmSync(readyPath("journal"));
        const regenerated = join(workspace.root, "regenerated.txt");
        workspace.write(
            "apps/journal/src/regenerate.ts",
            `import { execFileSync } from "node:child_process";
            import { existsSync, writeFileSync } from "node:fs";
            if (!existsSync(${JSON.stringify(regenerated)})) {
                execFileSync(process.execPath, [${JSON.stringify(workspace.cli("editor"))}, "codegen", "--force"], {
                    cwd: ${JSON.stringify(appDir("editor"))},
                });
                writeFileSync(${JSON.stringify(regenerated)}, "");
            }`,
        );
        renameSync(join(appDir("journal"), "src/index.tsx"), join(appDir("journal"), "src/app.tsx"));
        workspace.write("apps/journal/src/index.tsx", 'import "./regenerate.ts";\nimport "./app.tsx";\n');
        await withMcpClient(workspace.root, async (client) => {
            const session = spawn(
                process.execPath,
                [workspace.cli("journal"), "dev", "--headless", "--size", "640x480"],
                { cwd: appDir("journal"), env: childEnv() },
            );
            let output = "";
            session.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
            session.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
            const exited = once(session, "exit");
            const deadline = Date.now() + 120_000;
            try {
                while (!existsSync(readyPath("journal"))) {
                    if (session.exitCode !== null || session.signalCode !== null || Date.now() > deadline) {
                        throw new Error(`gtkx dev did not render the app:\n${output}`);
                    }
                    await setTimeout(200);
                }
                expect(existsSync(regenerated)).toBe(true);
                expect(readFileSync(readyPath("journal"), "utf8")).toBe("journal");
                expect(
                    await queryWidgets(client, { by: "role", value: "label", options: { name: "journal" } }),
                ).toHaveLength(1);
            } finally {
                session.kill("SIGTERM");
                await exited;
            }
        });
    });

    it("replaces edited stylesheets in place, appends edited global styles and refreshes raw imports, keeping state", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "probe.json");
        const theme = (version: number, globalRule: string) => `
            import { css, injectGlobal } from "@gtkx/css";
            injectGlobal\`${globalRule}\`;
            export const accent = css({ color: "rgb(${String(version)}, 0, 0)" });
            export const version = ${String(version)};
        `;
        project.write("src/theme.ts", theme(1, ".cli-global-probe { min-width: 231px; }"));
        project.write("src/sheet.css", ".cli-sheet-probe { min-width: 237px; }");
        project.write("src/snippet.css", ".cli-snippet-probe { min-width: 263px; }");
        project.write(
            "src/probe.tsx",
            `import * as Gtk from "@gtkx/gi/gtk";
            import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
            import { randomUUID } from "node:crypto";
            import { renameSync, writeFileSync } from "node:fs";
            import { useEffect, useRef, useState } from "react";
            import "./sheet.css";
            import sheetSource from "./sheet.css?raw";
            import snippetSource from "./snippet.css?raw";
            import { accent, version } from "./theme.ts";
            const width = (label: Gtk.Label | null) => label?.measure(Gtk.Orientation.HORIZONTAL, -1)[0] ?? 0;
            export function Probe() {
                const [token] = useState(() => randomUUID());
                const global = useRef<Gtk.Label | null>(null);
                const sheet = useRef<Gtk.Label | null>(null);
                const snippet = useRef<Gtk.Label | null>(null);
                useEffect(() => {
                    const timer = setInterval(() => {
                        const observed = {
                            pid: process.pid,
                            token,
                            version,
                            global: width(global.current),
                            sheet: width(sheet.current),
                            snippet: width(snippet.current),
                            sheetSource,
                            snippetSource,
                        };
                        writeFileSync(${JSON.stringify(readyPath)} + ".tmp", JSON.stringify(observed));
                        renameSync(${JSON.stringify(readyPath)} + ".tmp", ${JSON.stringify(readyPath)});
                    }, 100);
                    return () => clearInterval(timer);
                }, [token]);
                return (
                    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                        <GtkLabel ref={global} label="Global" cssClasses={["cli-global-probe", accent]} />
                        <GtkLabel ref={sheet} label="Sheet" cssClasses={["cli-sheet-probe"]} />
                        <GtkLabel ref={snippet} label="Snippet" cssClasses={["cli-snippet-probe"]} />
                    </GtkBox>
                );
            }`,
        );
        project.write(
            "src/index.tsx",
            `import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { createRoot } from "@gtkx/react";
            import { Probe } from "./probe.tsx";
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.example">
                    <AdwApplicationWindow><Probe /></AdwApplicationWindow>
                </AdwApplication>
            );`,
        );
        const observation = () =>
            JSON.parse(readFileSync(readyPath, "utf8")) as {
                pid: number;
                token: string;
                version: number;
                global: number;
                sheet: number;
                snippet: number;
                sheetSource: string;
                snippetSource: string;
            };
        await withSession("dev", project.root, readyPath, async () => {
            await expect.poll(() => observation(), { timeout: 30_000 }).toMatchObject({ global: 231, sheet: 237 });
            expect(observation().snippet).toBeLessThan(263);
            const { pid, token } = observation();

            project.write("src/theme.ts", theme(2, ".cli-global-probe { min-width: 241px; }"));
            await expect.poll(() => observation().global, { timeout: 30_000 }).toBe(241);
            expect(observation()).toMatchObject({ pid, token, version: 2 });

            project.write("src/theme.ts", theme(3, ".cli-other-probe { min-width: 241px; }"));
            await expect.poll(() => observation().version, { timeout: 30_000 }).toBe(3);
            expect(observation()).toMatchObject({ pid, token, global: 241 });

            project.write("src/sheet.css", ".cli-sheet-probe { min-width: 251px; }");
            await expect.poll(() => observation().sheet, { timeout: 30_000 }).toBe(251);
            await expect
                .poll(() => observation().sheetSource, { timeout: 30_000 })
                .toBe(".cli-sheet-probe { min-width: 251px; }");
            expect(observation()).toMatchObject({ pid, token });

            project.write("src/snippet.css", ".cli-snippet-probe { min-width: 271px; }");
            await expect
                .poll(() => observation().snippetSource, { timeout: 30_000 })
                .toBe(".cli-snippet-probe { min-width: 271px; }");
            expect(observation()).toMatchObject({ pid, token });
            expect(observation().snippet).toBeLessThan(263);

            project.write("src/sheet.css", ".cli-other-probe { min-width: 251px; }");
            await expect.poll(() => observation().sheet, { timeout: 30_000 }).toBeLessThan(237);
            expect(observation()).toMatchObject({ pid, token, version: 3 });
        });
    });

    it("generates upstream bindings and documentation through their command arguments", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"] });
        expect(await invoke(["codegen", "--cwd", project.root])).toContain("generated bindings missing");
        expect(existsSync(join(project.root, "node_modules/@gtkx/gi/gio/index.d.ts"))).toBe(true);
        expect(await invoke(["codegen", "--cwd", project.root])).toContain("codegen: bindings up to date");
        await invoke(["docs", "--cwd", project.root, "--out", "reference"]);
        const files = readdirSync(join(project.root, "reference"), { recursive: true });
        expect(files.some((file) => file.toString().endsWith(".md"))).toBe(true);
        await expect(invoke(["docs", "--cwd", project.root, "--out", "../outside"])).rejects.toThrow("below");
    });

    it.each([
        { name: "without a configuration file", config: null },
        { name: "whose configuration names no application ID", config: { codegen: false } },
    ])("tests a component library $name", async ({ config }) => {
        using project = createProject();
        if (config === null) {
            rmSync(join(project.root, "gtkx.config.ts"));
        } else {
            project.write("gtkx.config.ts", `export default ${JSON.stringify(config)};`);
            linkWorkspaceBindings(project.root);
        }
        project.write(
            "src/badge.tsx",
            `import { GtkLabel } from "@gtkx/jsx/gtk";
            export const Badge = ({ label }: { label: string }) => <GtkLabel label={label} cssClasses={["badge"]} />;`,
        );
        project.write(
            "tests/badge.test.tsx",
            `import { render, screen } from "@gtkx/testing";
            import { expect, test } from "vitest";
            import { Badge } from "../src/badge.tsx";
            test("renders the badge", async () => {
                await render(<Badge label="New" />);
                expect(await screen.findByText("New")).toBeTruthy();
            });`,
        );
        project.write(
            "vitest.config.mjs",
            `import gtkx from "@gtkx/cli/vitest-plugin";
            export default { plugins: [gtkx()], test: { include: ["tests/*.test.tsx"] } };`,
        );
        const runner = await createVitest({
            root: project.root,
            config: join(project.root, "vitest.config.mjs"),
            watch: false,
            reporters: [],
        });
        try {
            const results = await runner.start();
            expect(results.testModules.map((module) => module.state())).toEqual(["passed"]);
        } finally {
            await runner.close();
        }
        for (const path of ["AGENTS.md", "CLAUDE.md", ".gtkx/reference"]) {
            expect(existsSync(join(project.root, path))).toBe(false);
        }
    });

    it.each([
        { name: "without a configuration file", config: null },
        { name: "whose configuration names no application ID", config: { libraries: ["Gio-2.0"] } },
    ])("generates bindings and documentation for a component library $name", async ({ config }) => {
        using project = createProject();
        if (config === null) {
            rmSync(join(project.root, "gtkx.config.ts"));
        } else {
            project.write("gtkx.config.ts", `export default ${JSON.stringify(config)};`);
        }
        expect(await invoke(["codegen", "--cwd", project.root])).toContain("codegen: bindings generated");
        expect(existsSync(join(project.root, "node_modules/@gtkx/gi/gtk/index.d.ts"))).toBe(true);
        for (const path of ["AGENTS.md", "CLAUDE.md", ".gtkx/reference"]) {
            expect(existsSync(join(project.root, path))).toBe(false);
        }
        await invoke(["docs", "--cwd", project.root, "--out", "reference"]);
        expect(existsSync(join(project.root, "reference/index.md"))).toBe(true);
    });

    it.each(["dev", "build", "deploy"])("requires an application ID to %s a project", async (name) => {
        using project = createProject();
        project.write("gtkx.config.ts", `export default ${JSON.stringify({ codegen: false })};`);
        await expect(invoke([name, "--cwd", project.root])).rejects.toThrow(
            "is required to run, build or deploy an application",
        );
    });

    it("loads one copy of the bindings in tests after they are regenerated", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"] });
        project.write(
            "src/cancellable.ts",
            'import { Cancellable } from "@gtkx/gi/gio"; export const create = () => new Cancellable();',
        );
        const writeTest = (name: string) =>
            project.write(
                "tests/bindings.test.ts",
                `import { Cancellable } from "@gtkx/gi/gio";
                import { expect, test } from "vitest";
                import { create } from "../src/cancellable.js";
                test(${JSON.stringify(name)}, () => expect(create()).toBeInstanceOf(Cancellable));`,
            );
        project.write(
            "vitest.config.mjs",
            `import gtkx from "@gtkx/cli/vitest-plugin";
            export default { plugins: [gtkx()], test: { include: ["tests/*.test.ts"] } };`,
        );
        const runTests = async () => {
            const runner = await createVitest({
                root: project.root,
                config: join(project.root, "vitest.config.mjs"),
                watch: false,
                reporters: [],
            });
            try {
                const results = await runner.start();
                return results.testModules.map((module) => module.state());
            } finally {
                await runner.close();
            }
        };

        writeTest("creates a cancellable");
        expect(await runTests()).toEqual(["passed"]);
        await invoke(["codegen", "--cwd", project.root, "--force"]);
        writeTest("creates a cancellable after regeneration");
        expect(await runTests()).toEqual(["passed"]);
    });

    it("applies a changed React Compiler setting to the next test run", async () => {
        using project = createProject({ codegen: true });
        project.write(
            "src/reading.tsx",
            `import { GtkLabel } from "@gtkx/jsx/gtk";
            export const Reading = ({ source }: { source: { read: () => string } }) => <GtkLabel label={source.read()} />;`,
        );
        const writeTest = (expected: string) =>
            project.write(
                "tests/reading.test.tsx",
                `import { render, screen } from "@gtkx/testing";
                import { expect, test } from "vitest";
                import { Reading } from "../src/reading.js";
                test("shows ${expected} after a rerender", async () => {
                    let value = "first";
                    const source = { read: () => value };
                    const { rerender } = await render(<Reading source={source} />);
                    value = "second";
                    await rerender(<Reading source={source} />);
                    expect(await screen.findByText(${JSON.stringify(expected)})).toBeTruthy();
                });`,
            );
        project.write(
            "vitest.config.mjs",
            `import gtkx from "@gtkx/cli/vitest-plugin";
            export default { plugins: [gtkx()], test: { include: ["tests/*.test.tsx"] } };`,
        );
        const runTests = async () => {
            const runner = await createVitest({
                root: project.root,
                config: join(project.root, "vitest.config.mjs"),
                watch: false,
                reporters: [],
            });
            try {
                const results = await runner.start();
                return results.testModules.map((module) => module.state());
            } finally {
                await runner.close();
            }
        };

        writeTest("first");
        expect(await runTests()).toEqual(["passed"]);
        project.write(
            "gtkx.config.ts",
            `export default ${JSON.stringify({ applicationId: "org.gtkx.example", codegen: true, agents: { reference: false, rules: false }, reactCompiler: false })};`,
        );
        writeTest("second");
        expect(await runTests()).toEqual(["passed"]);
    });

    it("keeps the agent rules in step with the generated reference", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"], agents: { rules: true } });
        const rules = () => readFileSync(join(project.root, "AGENTS.md"), "utf8");
        await invoke(["codegen", "--cwd", project.root]);
        expect(rules()).toContain("`.gtkx/reference/index.md`");
        expect(existsSync(join(project.root, ".gtkx/reference/index.md"))).toBe(true);

        project.write(
            "gtkx.config.ts",
            `export default ${JSON.stringify({ applicationId: "org.gtkx.example", libraries: ["Gio-2.0"], agents: { reference: false } })};`,
        );
        await invoke(["codegen", "--cwd", project.root]);
        expect(rules()).not.toContain(".gtkx/reference");
        expect(existsSync(join(project.root, ".gtkx/reference"))).toBe(false);
    });

    it("writes agent rules that a Markdown formatter leaves unchanged", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"], agents: { rules: true } });
        await invoke(["codegen", "--cwd", project.root]);
        const rules = readFileSync(join(project.root, "AGENTS.md"), "utf8");
        expect((await format("AGENTS.md", rules)).code).toBe(rules);
    });

    it("lists only the commands that the project's packages provide in the agent rules", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"], agents: { rules: true } });
        const rules = () => readFileSync(join(project.root, "AGENTS.md"), "utf8");
        const hoisted = "node_modules/.pnpm/node_modules";
        const typescriptManifest = JSON.stringify({ name: "typescript", version: "6.0.3" });
        project.write(`${hoisted}/typescript/package.json`, typescriptManifest);
        const codegen = () =>
            promisify(execFile)(
                process.execPath,
                [join(project.root, "node_modules/@gtkx/cli/bin/gtkx.js"), "codegen"],
                {
                    cwd: project.root,
                    env: { ...process.env, NODE_PATH: join(project.root, hoisted) },
                },
            );

        await codegen();
        expect(rules()).toContain("`vitest run`");
        expect(rules()).not.toContain("`tsc --noEmit`");

        project.write("node_modules/typescript/package.json", typescriptManifest);
        await codegen();
        expect(rules()).toContain("`tsc --noEmit`");
    });

    it("removes the agent rules it wrote once rules are disabled", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"], agents: { rules: true } });
        const configure = (rules: boolean) =>
            project.write(
                "gtkx.config.ts",
                `export default ${JSON.stringify({ applicationId: "org.gtkx.example", libraries: ["Gio-2.0"], agents: { rules } })};`,
            );
        const agentsPath = join(project.root, "AGENTS.md");
        const claudePath = join(project.root, "CLAUDE.md");
        await invoke(["codegen", "--cwd", project.root]);
        expect(existsSync(claudePath)).toBe(true);

        configure(false);
        await invoke(["codegen", "--cwd", project.root]);
        expect(existsSync(agentsPath)).toBe(false);
        expect(existsSync(claudePath)).toBe(false);

        project.write("AGENTS.md", "# Notes\n\nKeep this.\n");
        configure(true);
        await invoke(["codegen", "--cwd", project.root]);
        expect(readFileSync(agentsPath, "utf8")).toContain("gtkx-agent-rules");

        configure(false);
        await invoke(["codegen", "--cwd", project.root]);
        expect(readFileSync(agentsPath, "utf8")).toBe("# Notes\n\nKeep this.\n");
        expect(existsSync(claudePath)).toBe(true);
    });

    it("creates a project through the gtkx create alias", async () => {
        using project = createProject();
        const target = join(project.root, "created");
        await invoke(["create", target, "--no-interactive", "--skip-install", "--application-id", "org.gtkx.created"]);
        expect(JSON.parse(readFileSync(join(target, "package.json"), "utf8"))).toHaveProperty("name", "created");
    });

    it("previews and removes stale compile caches without touching unrelated directories", async () => {
        using project = createProject();
        vi.stubEnv("XDG_CACHE_HOME", project.root);
        const stale = join(project.root, "gtkx/compile-cache/v0.0.0-x64-old");
        mkdirSync(stale, { recursive: true });
        project.write("unrelated/keep.txt", "keep");
        await invoke(["cleanup", "--dry-run"]);
        expect(existsSync(stale)).toBe(true);
        await invoke(["cleanup"]);
        expect(existsSync(stale)).toBe(false);
        expect(existsSync(join(project.root, "unrelated/keep.txt"))).toBe(true);
    });

    it("writes editor MCP configuration and preserves other registered servers", async () => {
        using project = createProject();
        project.write(
            ".mcp.json",
            '{"mcpServers":{"other":{"command":"other"},"gtkx":{"command":"npx","args":["gtkx","mcp"]}}}',
        );
        await invoke(["mcp", "init", "--cwd", project.root, "--client", "claude"]);
        expect(JSON.parse(readFileSync(join(project.root, ".mcp.json"), "utf8"))).toEqual({
            mcpServers: { other: { command: "other" }, gtkx: { command: "npx", args: ["--no", "gtkx", "mcp"] } },
        });
        await expect(invoke(["mcp", "init", "--cwd", project.root, "--client", "missing"])).rejects.toThrow();
    });

    it("runs an MCP server with parsed tool restrictions", async () => {
        using project = createProject();
        const controller = new AbortController();
        const [clientTransport, transport] = InMemoryTransport.createLinkedPair();
        const selected = createCommand({
            signal: controller.signal,
            transport,
            socketPath: join(project.root, "mcp.sock"),
        });
        const client = new Client({ name: "command-test", version: "1.0.0" });
        try {
            await invoke(["mcp", "--cwd", project.root, "--read-only"], selected);
            await client.connect(clientTransport);
            const tools = (await client.listTools()).tools.map((tool) => tool.name);
            expect(tools).toContain("gtkx_get_widget_tree");
            expect(tools).not.toContain("gtkx_click");
        } finally {
            controller.abort();
            await client.close();
            await expect.poll(() => existsSync(join(project.root, "mcp.sock"))).toBe(false);
        }
    });

    it("writes deployment manifests and stages a real built application", async () => {
        using project = createProject({
            deploy: {
                name: "CLI Example",
                summary: "Exercises the deployment command",
                categories: ["Utility"],
                description: ["An example application used to exercise real deployment output."],
                developer: { name: "GTKX", email: "hello@gtkx.dev" },
                license: "MIT",
                homepage: "https://gtkx.dev",
                node: { source: "path", path: "tools/node", shouldStrip: false },
                extraFiles: {
                    "share/man/man1/cli-example.1": "packaging/cli-example.1",
                    "share/bash-completion/completions/cli-example": "packaging/cli-example.bash",
                    "share/cli-example/presets/default.json": "packaging/default.json",
                },
            },
        });
        project.write("LICENSE", "MIT License\nCopyright GTKX\nPermission is hereby granted, free of charge.\n");
        project.write("packaging/cli-example.1", ".TH CLI-EXAMPLE 1\n");
        project.write("packaging/cli-example.bash", "complete -W --help cli-example\n");
        project.write("packaging/default.json", "{}\n");
        const nodeLicense = "Node.js is licensed for use as follows: vendored runtime license";
        project.write("vendor/node/LICENSE", nodeLicense);
        mkdirSync(join(project.root, "vendor/node/bin"));
        copyFileSync(process.execPath, join(project.root, "vendor/node/bin/node"));
        mkdirSync(join(project.root, "tools"));
        symlinkSync("../vendor/node/bin/node", join(project.root, "tools/node"));
        project.write(
            "icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
        );
        const config = readFileSync(join(project.root, "gtkx.config.ts"), "utf8");
        project.write(
            "gtkx.config.ts",
            config.replace('"codegen":false', '"codegen":false,"applicationIcon":"icon.svg"'),
        );
        project.write(
            "data/org.gtkx.example.gschema.xml",
            `<?xml version="1.0" encoding="UTF-8"?>
            <schemalist>
                <schema id="org.gtkx.example" path="/org/gtkx/example/">
                    <key name="font" type="s"><default>'Monospace 12'</default></key>
                </schema>
            </schemalist>`,
        );
        project.write("src/index.ts", 'export { default } from "../data/org.gtkx.example.gschema.xml";');
        await invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "appimage,deb,flatpak,rpm"]);
        const build = join(project.root, "build", process.arch);
        const contents = (packager: string) =>
            (
                parse(readFileSync(join(build, "targets", packager, "nfpm.yaml"), "utf8")) as {
                    contents: { dst: string; type?: string }[];
                }
            ).contents;
        const packaged = (packager: string) => contents(packager).map((content) => content.dst);
        for (const packager of ["deb", "rpm"]) {
            expect(packaged(packager)).toContain("/usr/share/glib-2.0/schemas/org.gtkx.example.gschema.xml");
            expect(packaged(packager).filter((path) => path.endsWith("gschemas.compiled"))).toEqual([]);
        }
        expect(
            contents("rpm")
                .filter((content) => content.type === "dir" && content.dst.startsWith("/usr/share"))
                .map((content) => content.dst),
        ).toEqual(["/usr/share/cli-example", "/usr/share/cli-example/presets", "/usr/share/licenses/cli-example"]);
        const flatpak = parse(readFileSync(join(build, "targets/flatpak/org.gtkx.example.yml"), "utf8")) as {
            modules: { "post-install": string[] }[];
        };
        expect(flatpak.modules.at(-1)?.["post-install"]).toEqual([
            "glib-compile-schemas ${FLATPAK_DEST}/share/glib-2.0/schemas",
        ]);
        expect(existsSync(join(build, "stage/lib/cli-example/gschemas.compiled"))).toBe(false);
        expect(existsSync(join(build, "overlay/appimage/lib/cli-example/gschemas.compiled"))).toBe(true);
        const files = readdirSync(join(project.root, "build"), { recursive: true }).map(String);
        expect(files).toEqual(
            expect.arrayContaining([
                expect.stringContaining("targets/deb/nfpm.yaml"),
                expect.stringContaining("targets/rpm/nfpm.yaml"),
                expect.stringContaining("targets/flatpak/org.gtkx.example.yml"),
            ]),
        );
        expect(files.some((file) => file.endsWith("bundle.mjs"))).toBe(true);
        expect(
            readFileSync(join(project.root, "build", process.arch, "targets/flatpak/org.gtkx.example.yml"), "utf8"),
        ).toContain("separate-locales: false");
        const notices = readFileSync(
            join(project.root, "build", process.arch, "overlay/rpm/share/licenses/cli-example/THIRD-PARTY-NOTICES"),
            "utf8",
        );
        expect(notices).toContain(nodeLicense);
    });

    it("requires the shared libraries of configured GIR libraries in system packages", async () => {
        const deploy = {
            name: "CLI Example",
            summary: "Exercises the deployment command",
            categories: ["Utility"],
            description: ["An example application used to exercise real deployment output."],
            developer: { name: "GTKX", email: "hello@gtkx.dev" },
            license: "MIT",
        };
        const config = { codegen: true, applicationIcon: "icon.svg", libraries: ["GtkSource-5"] };
        using project = createProject({ ...config, deploy });
        project.write("LICENSE", "MIT License\nCopyright GTKX\nPermission is hereby granted, free of charge.\n");
        project.write(
            "icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
        );
        const depends = (packager: string) =>
            (
                parse(
                    readFileSync(join(project.root, "build", process.arch, "targets", packager, "nfpm.yaml"), "utf8"),
                ) as {
                    depends: string[];
                }
            ).depends;
        const output = await invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "deb,rpm"]);
        expect(depends("rpm")).toEqual(
            expect.arrayContaining([
                "libgtk-4.so.1()(64bit)",
                "libadwaita-1.so.0()(64bit)",
                "libgtksourceview-5.so.0()(64bit)",
            ]),
        );
        expect(output).toContain("GtkSource-5 (libgtksourceview-5.so.0)");
        expect(output).toContain("`deploy.depends.deb`");
        project.write(
            "gtkx.config.ts",
            `export default ${JSON.stringify({
                applicationId: "org.gtkx.example",
                agents: { reference: false, rules: false },
                ...config,
                deploy: { ...deploy, depends: { deb: ["libgtksourceview-5-0"] } },
            })};`,
        );
        const covered = await invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "deb"]);
        expect(depends("deb")).toContain("libgtksourceview-5-0");
        expect(covered).not.toContain("`deploy.depends.deb`");
    });

    it("renders a source Flatpak that installs with pnpm 12's native binary and keeps workers and translations", async () => {
        using project = createProject({
            applicationIcon: "icon.svg",
            deploy: {
                name: "CLI Example",
                summary: "Exercises the source Flatpak manifest",
                categories: ["Utility"],
                keywords: ["example", "manifest"],
                description: ["An example application used to exercise a Flathub source manifest."],
                developer: { id: "dev.gtkx", name: "GTKX", email: "hello@gtkx.dev" },
                license: "MIT",
                homepage: "https://gtkx.dev",
                releases: [{ version: "1.0.0", date: "2026-10-30" }],
                contentRating: {},
                flatpak: {
                    mode: "source",
                    source: { url: "https://example.org/cli-example.git", commit: "0".repeat(40) },
                },
            },
        });
        project.write("LICENSE", "MIT License\nCopyright GTKX\nPermission is hereby granted, free of charge.\n");
        project.write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n\nimporters:\n\n  .: {}\n");
        project.write("po/LINGUAS", "fr\n");
        project.write("po/fr.po", readFileSync(new URL("../../i18n/tests/fixtures/fr.po", import.meta.url), "utf8"));
        project.write(
            "icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
        );
        await invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "flatpak"]);
        expect(readdirSync(join(project.root, "po")).toSorted()).toEqual([
            "LINGUAS",
            "POTFILES.in",
            "fr.po",
            "org.gtkx.example.pot",
        ]);
        expect(readFileSync(join(project.root, "po/org.gtkx.example.pot"), "utf8")).toMatch(
            /^#\. Translators: .* Do NOT translate or localize the semicolons! .*\n#: .*\nmsgid "example;manifest;"$/m,
        );
        const manifest = parse(
            readFileSync(join(project.root, "build", process.arch, "targets/flatpak/org.gtkx.example.yml"), "utf8"),
        ) as { modules: { sources: Record<string, unknown>[]; "build-commands": string[] }[] };
        const module = manifest.modules.at(-1);
        const nativeBinaries = module?.sources
            .filter((source) => String(source.url).includes("/@pnpm/exe."))
            .map((source) => ({
                type: source.type,
                url: source.url,
                hasDigest: /^[\da-f]{128}$/.test(String(source.sha512)),
                onlyArches: source["only-arches"],
            }));
        expect(nativeBinaries).toEqual([
            {
                type: "archive",
                url: "https://registry.npmjs.org/@pnpm/exe.linux-arm64/-/exe.linux-arm64-12.4.2.tgz",
                hasDigest: true,
                onlyArches: ["aarch64"],
            },
            {
                type: "archive",
                url: "https://registry.npmjs.org/@pnpm/exe.linux-x64/-/exe.linux-x64-12.4.2.tgz",
                hasDigest: true,
                onlyArches: ["x86_64"],
            },
        ]);
        expect(module?.["build-commands"].some((command) => command.startsWith("test ! -d dist/workers ||"))).toBe(
            true,
        );
        expect(JSON.stringify(module)).not.toContain("pnpm.cjs");
        expect(JSON.stringify(module)).not.toContain("gschemas.compiled");
        const localeConfig = module?.sources.find((source) => source["dest-filename"] === "gtkx-i18n.json");
        expect(JSON.parse(String(localeConfig?.contents))).toEqual({ localeDir: "../../share/locale" });
        expect(
            module?.["build-commands"].some((command) =>
                command.endsWith("gtkx-i18n.json ${FLATPAK_DEST}/lib/cli-example/gtkx-i18n.json"),
            ),
        ).toBe(true);
    });

    it("renders a source Flatpak that installs a Yarn 4 project with its pinned Yarn release", async () => {
        const digest =
            "b2e1e7524f654f2749d32b4ebcb4622473cb5bcbc485df2007e12a154e50162a4d795526768bc5f5b8f81717bfd79deb" +
            "2472813d86fb5ae2eb551fa9c872b08f";
        using project = createProject({
            applicationIcon: "icon.svg",
            deploy: {
                name: "CLI Example",
                summary: "Exercises the source Flatpak manifest",
                categories: ["Utility"],
                description: ["An example application used to exercise a Flathub source manifest."],
                developer: { id: "dev.gtkx", name: "GTKX", email: "hello@gtkx.dev" },
                license: "MIT",
                homepage: "https://gtkx.dev",
                releases: [{ version: "1.0.0", date: "2026-11-04" }],
                contentRating: {},
                flatpak: {
                    mode: "source",
                    source: { url: "https://example.org/cli-example.git", commit: "0".repeat(40) },
                },
            },
        });
        project.write(
            "package.json",
            JSON.stringify({
                name: "cli-example",
                version: "1.0.0",
                type: "module",
                license: "MIT",
                packageManager: `yarn@4.18.1+sha512.${digest}`,
                dependencies: {},
            }),
        );
        project.write(
            "yarn.lock",
            '__metadata:\n  version: 10\n  cacheKey: 10c0\n\n"cli-example@workspace:.":\n  version: 0.0.0-use.local\n' +
                '  resolution: "cli-example@workspace:."\n  languageName: unknown\n  linkType: soft\n',
        );
        project.write(
            "icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>',
        );
        await invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "flatpak"]);
        const manifest = parse(
            readFileSync(join(project.root, "build", process.arch, "targets/flatpak/org.gtkx.example.yml"), "utf8"),
        ) as {
            modules: {
                "build-options": { "append-path": string; env: Record<string, string> };
                sources: Record<string, unknown>[];
                "build-commands": string[];
            }[];
        };
        const module = manifest.modules.at(-1);
        expect(module?.sources).toContainEqual({
            type: "file",
            url: "https://repo.yarnpkg.com/4.18.1/packages/yarnpkg-cli/bin/yarn.js",
            sha512: digest,
            dest: "flatpak-yarn",
            "dest-filename": "yarn.cjs",
        });
        expect(module?.sources).toContainEqual({
            type: "script",
            dest: "flatpak-yarn",
            "dest-filename": "yarn",
            commands: ['exec node /run/build/cli-example/flatpak-yarn/yarn.cjs "$@"'],
        });
        expect(module?.["build-options"]["append-path"]).toBe(
            "/run/build/cli-example/flatpak-yarn:/usr/lib/sdk/node26/bin",
        );
        expect(module?.["build-options"].env).toEqual({
            npm_config_nodedir: "/usr/lib/sdk/node26",
            YARN_ENABLE_NETWORK: "0",
            YARN_ENABLE_GLOBAL_CACHE: "0",
            YARN_GLOBAL_FOLDER: "/run/build/cli-example/flatpak-node/yarn-berry",
        });
        expect(module?.["build-commands"].slice(0, 3)).toEqual([
            "yarn plugin import /run/build/cli-example/flatpak-node/flatpak-yarn.js",
            "yarn convertToZip /usr/lib/sdk/node26/bin/yarn",
            "yarn install --immutable",
        ]);
    });

    it("stops a source Flatpak of a workspace member and points to a standalone project", async () => {
        using project = createProject();
        project.write(
            "package.json",
            JSON.stringify({ name: "studio", private: true, type: "module", workspaces: ["apps/*"] }),
        );
        project.write("yarn.lock", "__metadata:\n  version: 10\n  cacheKey: 10c0\n");
        project.write(
            "apps/swatches/package.json",
            JSON.stringify({ name: "swatches", version: "1.0.0", type: "module", license: "MIT", dependencies: {} }),
        );
        project.write(
            "apps/swatches/gtkx.config.ts",
            `export default ${JSON.stringify({
                applicationId: "org.gtkx.swatches",
                codegen: false,
                agents: { reference: false, rules: false },
                deploy: {
                    name: "Swatches",
                    summary: "Exercises a workspace member's source Flatpak",
                    categories: ["Utility"],
                    description: ["An example application inside a workspace."],
                    developer: { id: "dev.gtkx", name: "GTKX", email: "hello@gtkx.dev" },
                    license: "MIT",
                    homepage: "https://gtkx.dev",
                    flatpak: {
                        mode: "source",
                        source: { url: "https://example.org/studio.git", commit: "0".repeat(40) },
                    },
                },
            })};`,
        );
        project.write("apps/swatches/src/index.ts", 'export const greeting = "hello from a member";');
        const app = join(project.root, "apps/swatches");
        const deploy = invoke(["deploy", "--cwd", app, "--print-manifests", "--target", "flatpak"]);
        await expect(deploy).rejects.toThrow(`member of the workspace at ${project.root}`);
        await expect(deploy).rejects.toThrow("standalone project");
        expect(existsSync(join(app, "build"))).toBe(false);
    });

    it("preserves arguments, configuration, translations and MCP across headless dev restarts", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const argumentsPath = join(project.root, "arguments.json");
        const resourcesPath = join(project.root, "resources.json");
        const applicationArgs = ["--example", "a value", "--config=app-owned"];
        project.write("po/LINGUAS", "fr\n");
        project.write("po/fr.po", readFileSync(new URL("../../i18n/tests/fixtures/fr.po", import.meta.url), "utf8"));
        vi.stubEnv("LANG", "fr_FR.UTF-8");
        vi.stubEnv("LC_ALL", "fr_FR.UTF-8");
        vi.stubEnv("LANGUAGE", "fr");
        const application = (revision: string) => `import { Application } from "@gtkx/gi/gio";
            import { t } from "@gtkx/i18n";
            import { applicationId } from "virtual:gtkx-config";
            import { writeFileSync } from "node:fs";
            export const application = new Application({ applicationId });
            application.setDefault();
            application.register(null);
            application.hold();
            writeFileSync(${JSON.stringify(argumentsPath)}, JSON.stringify(process.argv.slice(2)));
            writeFileSync(${JSON.stringify(resourcesPath)}, JSON.stringify(process.getActiveResourcesInfo()));
            writeFileSync(${JSON.stringify(readyPath)}, ${JSON.stringify(revision)} + ":" + applicationId + ":" + t("Hello, {{name}}!", { name: "Ada" }));`;
        project.write("src/index.ts", application("initial"));
        project.write("custom.config.ts", readFileSync(join(project.root, "gtkx.config.ts"), "utf8"));
        project.write("gtkx.config.ts", 'export default { applicationId: "org.gtkx.unselected", codegen: false };');
        vi.stubEnv("GTKX_MCP_SOCKET_PATH", undefined);
        vi.stubEnv("XDG_RUNTIME_DIR", project.root);
        const [clientTransport, transport] = InMemoryTransport.createLinkedPair();
        const server = createMcpServer({
            transport,
            socketPath: join(project.root, "gtkx-mcp.sock"),
            version: "1.0.0",
        });
        const client = new Client({ name: "dev-session-test", version: "1.0.0" });
        try {
            await server.start();
            await client.connect(clientTransport);
            await withSession(
                "dev",
                project.root,
                readyPath,
                async () => {
                    expect(readFileSync(readyPath, "utf8")).toBe("initial:org.gtkx.example:Bonjour, Ada !");
                    expect(JSON.parse(readFileSync(argumentsPath, "utf8"))).toEqual(applicationArgs);
                    expect(process.env.GTKX_MCP_SOCKET_PATH).toBeUndefined();
                    expect(JSON.parse(readFileSync(resourcesPath, "utf8"))).not.toContain("TCPServerWrap");
                    const apps = await client.callTool({
                        name: "gtkx_list_apps",
                        arguments: { waitForApps: true, timeout: 30_000 },
                    });
                    expect(JSON.stringify(apps)).toContain("org.gtkx.example");
                    project.write("src/index.ts", application("updated"));
                    await expect
                        .poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 })
                        .toBe("updated:org.gtkx.example:Bonjour, Ada !");
                    const configPath = join(project.root, "custom.config.ts");
                    project.write(
                        "custom.config.ts",
                        readFileSync(configPath, "utf8").replace("org.gtkx.example", "org.gtkx.reloaded"),
                    );
                    await expect
                        .poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 })
                        .toBe("updated:org.gtkx.reloaded:Bonjour, Ada !");
                    expect(JSON.parse(readFileSync(argumentsPath, "utf8"))).toEqual(applicationArgs);
                    await expect
                        .poll(async () => JSON.stringify(await client.callTool({ name: "gtkx_list_apps" })), {
                            timeout: 30_000,
                        })
                        .toContain("org.gtkx.reloaded");
                },
                ["--config", "custom.config.ts"],
                applicationArgs,
            );
        } finally {
            await client.close();
            await server.stop();
        }
    });

    it("keeps the production translation domain and program name under a development application ID", async () => {
        using project = createProject({ codegen: true, $development: { applicationId: "org.gtkx.example.Devel" } });
        const readyPath = join(project.root, "ready.txt");
        project.write("po/LINGUAS", "fr\n");
        project.write("po/fr.po", readFileSync(new URL("../../i18n/tests/fixtures/fr.po", import.meta.url), "utf8"));
        vi.stubEnv("LANG", "fr_FR.UTF-8");
        vi.stubEnv("LC_ALL", "fr_FR.UTF-8");
        vi.stubEnv("LANGUAGE", "fr");
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { getPrgname } from "@gtkx/gi/glib";
            import { t } from "@gtkx/i18n";
            import { applicationId } from "virtual:gtkx-config";
            import { writeFileSync } from "node:fs";
            export const application = new Application({ applicationId });
            application.setDefault();
            application.register(null);
            application.hold();
            writeFileSync(${JSON.stringify(readyPath)}, [applicationId, getPrgname(), t("Hello, {{name}}!", { name: "Ada" })].join(":"));`,
        );
        await withSession("dev", project.root, readyPath, () => Promise.resolve());
        expect(readFileSync(readyPath, "utf8")).toBe("org.gtkx.example.Devel:example:Bonjour, Ada !");
        expect(readdirSync(join(project.root, "po")).toSorted()).toEqual([
            "LINGUAS",
            "POTFILES.in",
            "fr.po",
            "org.gtkx.example.pot",
        ]);
    });

    it("keeps the dev session through malformed catalogs added while it runs", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const catalog = readFileSync(new URL("../../i18n/tests/fixtures/fr.po", import.meta.url), "utf8");
        vi.stubEnv("LANG", "fr_FR.UTF-8");
        vi.stubEnv("LC_ALL", "fr_FR.UTF-8");
        vi.stubEnv("LANGUAGE", "fr");
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { t } from "@gtkx/i18n";
            import { applicationId } from "virtual:gtkx-config";
            import { writeFileSync } from "node:fs";
            export const application = new Application({ applicationId });
            application.setDefault();
            application.register(null);
            application.hold();
            writeFileSync(${JSON.stringify(readyPath)}, t("Hello, {{name}}!", { name: "Ada" }));`,
        );
        await withSession("dev", project.root, readyPath, async () => {
            expect(readFileSync(readyPath, "utf8")).toBe("Hello, Ada!");
            project.write("po/fr.po", `${catalog}\nmsgid "Unterminated\n`);
            project.write("po/LINGUAS", "fr\n");
            await expect
                .poll(() => existsSync(join(project.root, "po/org.gtkx.example.pot")), { timeout: 30_000 })
                .toBe(true);
            project.write("po/fr.po", catalog);
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("Bonjour, Ada !");
        });
    });

    it("keeps the running app registered while configuration is invalid and restarts after repair", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const editedPath = join(project.root, "edited.txt");
        const configPath = join(project.root, "custom.config.ts");
        const config = readFileSync(join(project.root, "gtkx.config.ts"), "utf8");
        project.write("custom.config.ts", config);
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { applicationId } from "virtual:gtkx-config";
            import { existsSync, writeFileSync } from "node:fs";
            export const application = new Application({ applicationId: applicationId + ".Runtime" });
            application.setDefault();
            application.register(null);
            application.hold();
            if (!existsSync(${JSON.stringify(editedPath)})) {
                writeFileSync(${JSON.stringify(configPath)}, 'export default { applicationId: "invalid" };');
                writeFileSync(${JSON.stringify(editedPath)}, "edited");
            }
            writeFileSync(${JSON.stringify(readyPath)}, application.applicationId);`,
        );
        const socketPath = join(project.root, "mcp.sock");
        vi.stubEnv("GTKX_MCP_SOCKET_PATH", socketPath);
        const [clientTransport, transport] = InMemoryTransport.createLinkedPair();
        const server = createMcpServer({ transport, socketPath, version: "1.0.0" });
        const client = new Client({ name: "config-edit-test", version: "1.0.0" });
        try {
            await server.start();
            await client.connect(clientTransport);
            await withSession(
                "dev",
                project.root,
                readyPath,
                async () => {
                    expect(readFileSync(readyPath, "utf8")).toBe("org.gtkx.example.Runtime");
                    const apps = await client.callTool({
                        name: "gtkx_list_apps",
                        arguments: { waitForApps: true, timeout: 10_000 },
                    });
                    expect(JSON.stringify(apps)).toContain("org.gtkx.example");
                    expect(JSON.stringify(apps)).not.toContain("org.gtkx.example.Runtime");
                    project.write("custom.config.ts", config.replace("org.gtkx.example", "org.gtkx.repaired"));
                    await expect
                        .poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 })
                        .toBe("org.gtkx.repaired.Runtime");
                    await expect
                        .poll(async () => JSON.stringify(await client.callTool({ name: "gtkx_list_apps" })), {
                            timeout: 30_000,
                        })
                        .toContain("org.gtkx.repaired");
                },
                ["--config", "custom.config.ts"],
            );
        } finally {
            await client.close();
            await server.stop();
        }
    });

    it("keeps the dev session up after the application fails while activating", async () => {
        using project = createProject({ codegen: true });
        const failedPath = join(project.root, "failed.txt");
        const readyPath = join(project.root, "ready.txt");
        const entry = (activate: string) => `import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { createRoot } from "@gtkx/react";
            import { writeFileSync } from "node:fs";
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.example" onActivate={() => { ${activate} }}>
                    <AdwApplicationWindow />
                </AdwApplication>
            );`;
        project.write(
            "src/index.tsx",
            entry(`writeFileSync(${JSON.stringify(failedPath)}, "failed"); throw new Error("Activation failed");`),
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, failedPath, async () => {
                await expect
                    .poll(async () => (await callTool(client, "gtkx_get_widget_tree", { appTimeout: 1000 })).text, {
                        timeout: 30_000,
                    })
                    .toContain("Activation failed");
                project.write("src/index.tsx", entry(`writeFileSync(${JSON.stringify(readyPath)}, "ready");`));
                await expect.poll(() => existsSync(readyPath), { timeout: 30_000 }).toBe(true);
            });
        });
    });

    it("waits once for a change after the application fails while starting", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `export const Content = () => {
                throw new Error("Rendering the card failed");
            };`,
        );
        await withMcpClient(project.root, async (client) => {
            const session = spawn(
                process.execPath,
                [join(project.root, "node_modules/@gtkx/cli/bin/gtkx.js"), "dev", "--headless", "--size", "640x480"],
                {
                    cwd: project.root,
                    env: Object.fromEntries(
                        Object.entries(process.env).filter(
                            ([name]) => !name.startsWith("VITEST") && name !== "DISPLAY",
                        ),
                    ),
                },
            );
            let output = "";
            session.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
            session.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
            const exited = once(session, "exit");
            try {
                await expect
                    .poll(async () => (await callTool(client, "gtkx_get_widget_tree", { appTimeout: 1000 })).text, {
                        timeout: 60_000,
                    })
                    .toContain("Rendering the card failed");
                project.write("src/content.tsx", "export const Content = () => null;");
                await expect.poll(() => existsSync(readyPath), { timeout: 60_000 }).toBe(true);
            } finally {
                session.kill("SIGTERM");
                await exited;
            }
            expect(output.match(/Waiting for a change/g)).toHaveLength(1);
        });
    });

    it("points application errors in development at the source line that threw", async () => {
        using project = createProject();
        writeWidgetApp(
            project,
            join(project.root, "ready.txt"),
            [
                `import { useEffect, useState } from "react";`,
                `export const Content = () => {`,
                `    const [isBroken, setIsBroken] = useState(false);`,
                `    useEffect(() => setIsBroken(true), []);`,
                `    if (isBroken) throw new Error("Rendering the card failed");`,
                `    return null;`,
                `};`,
            ].join("\n"),
        );
        const session = spawn(
            process.execPath,
            [join(project.root, "node_modules/@gtkx/cli/bin/gtkx.js"), "dev", "--headless", "--size", "640x480"],
            {
                cwd: project.root,
                env: Object.fromEntries(
                    Object.entries(process.env).filter(([name]) => !name.startsWith("VITEST") && name !== "DISPLAY"),
                ),
            },
        );
        let output = "";
        session.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
        session.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
        const exited = once(session, "exit");
        try {
            await expect.poll(() => output, { timeout: 60_000 }).toContain("Waiting for a change");
            expect(output).toMatch(/at Content \(.*\/src\/content\.tsx:5:\d+\)/);
        } finally {
            session.kill("SIGTERM");
            await exited;
        }
    });

    it("tells MCP clients which error stopped the application", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const failPath = join(project.root, ".gtkx", "fail");
        project.write(
            "src/index.tsx",
            `import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { createRoot } from "@gtkx/react";
            import { existsSync, writeFileSync } from "node:fs";
            import { useEffect, useState } from "react";
            const Content = () => {
                const [hasFailed, setHasFailed] = useState(false);
                useEffect(() => {
                    writeFileSync(${JSON.stringify(readyPath)}, "ready");
                    const timer = setInterval(() => setHasFailed(existsSync(${JSON.stringify(failPath)})), 50);
                    return () => clearInterval(timer);
                }, []);
                if (hasFailed) throw new Error("Rendering the preview failed");
                return null;
            };
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.example">
                    <AdwApplicationWindow><Content /></AdwApplicationWindow>
                </AdwApplication>
            );`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const apps = await client.callTool({
                    name: "gtkx_list_apps",
                    arguments: { waitForApps: true, timeout: 30_000 },
                });
                expect(JSON.stringify(apps)).toContain("org.gtkx.example");
                project.write(".gtkx/fail", "fail");
                await expect
                    .poll(async () => JSON.stringify(await client.callTool({ name: "gtkx_get_widget_tree" })), {
                        timeout: 30_000,
                    })
                    .toContain("Rendering the preview failed");
                const listed = await callTool(client, "gtkx_list_apps");
                const [app] = JSON.parse(listed.text) as { applicationId: string; windows?: unknown; error?: string }[];
                expect(app).toMatchObject({ applicationId: "org.gtkx.example" });
                expect(app?.windows).toBeUndefined();
                expect(app?.error).toContain("Rendering the preview failed");
            });
        });
    });

    it("ends the application like Node when a native callback throws, unless the app handles it", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        const failPath = join(project.root, ".gtkx", "fail");
        const handledPath = join(project.root, "handled.txt");
        const content = (setup: string) =>
            `import * as GLib from "@gtkx/gi/glib";
            import { existsSync, rmSync, writeFileSync } from "node:fs";
            import { useEffect } from "react";
            ${setup}
            export const Content = () => {
                useEffect(() => {
                    const source = GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 50, () => {
                        if (existsSync(${JSON.stringify(failPath)})) {
                            rmSync(${JSON.stringify(failPath)});
                            throw new Error("Saving the draft failed");
                        }
                        return GLib.SOURCE_CONTINUE;
                    });
                    return () => GLib.sourceRemove(source);
                }, []);
                return null;
            };`;
        const listedApp = async (client: Client) =>
            (
                JSON.parse((await callTool(client, "gtkx_list_apps")).text) as {
                    windows?: unknown;
                    error?: string;
                }[]
            )[0];
        writeWidgetApp(project, readyPath, content(""));
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                project.write(".gtkx/fail", "fail");
                await expect
                    .poll(async () => (await listedApp(client))?.error, { timeout: 30_000 })
                    .toContain("Saving the draft failed");
                rmSync(readyPath);
                project.write(
                    "src/content.tsx",
                    content(
                        `process.on("uncaughtException", (error) => writeFileSync(${JSON.stringify(handledPath)}, String(error)));`,
                    ),
                );
                await expect.poll(() => existsSync(readyPath), { timeout: 30_000 }).toBe(true);
                project.write(".gtkx/fail", "fail");
                await expect.poll(() => existsSync(handledPath), { timeout: 30_000 }).toBe(true);
                expect((await listedApp(client))?.windows).toBeDefined();
            });
        });
    });

    it("summarizes widgets by their accessible name and reads boxed properties as text", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import * as Gdk from "@gtkx/gi/gdk";
            import { GtkBox, GtkButton, GtkColorDialog, GtkColorDialogButton, GtkLabel } from "@gtkx/jsx/gtk";
            const accent = new Gdk.RGBA({ red: 1, green: 0.5, blue: 0, alpha: 1 });
            export const Content = () => (
                <GtkBox>
                    <GtkButton iconName="list-add-symbolic" tooltipText="New Note" />
                    <GtkColorDialogButton tooltipText="Accent" rgba={accent} dialog={<GtkColorDialog />} />
                    <GtkLabel label="0.3048" accessibleLabel="Result value" />
                </GtkBox>
            );`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                expect(await queryWidgets(client, { by: "name", value: "New Note" })).toEqual([
                    expect.objectContaining({ type: "Button", name: "New Note" }),
                ]);
                expect(await queryWidgets(client, { by: "name", value: "Result value" })).toEqual([
                    expect.objectContaining({ type: "Label", text: "0.3048" }),
                ]);
                const [swatch] = await queryWidgets(client, { by: "name", value: "Accent" });
                const props = await callTool(client, "gtkx_get_widget_props", {
                    widgetId: swatch?.id,
                    properties: ["rgba"],
                    maxDepth: 0,
                });
                expect(JSON.parse(props.text)).toMatchObject({
                    properties: { rgba: { type: "GdkRGBA", value: "rgb(255,128,0)" } },
                });
            });
        });
    });

    it("keeps the dev session up when an MCP click makes the application throw", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        const content = (shouldThrow: boolean) =>
            `import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
            import { useLayoutEffect, useState } from "react";
            const Preview = ({ part }: { part: string }) => {
                useLayoutEffect(() => {
                    if (${String(shouldThrow)}) throw new Error(\`Showing the \${part} failed\`);
                }, []);
                return null;
            };
            export const Content = () => {
                const [isOpen, setIsOpen] = useState(false);
                return (
                    <GtkBox>
                        <GtkButton label="Open" onClicked={() => setIsOpen(true)} />
                        {isOpen && <><Preview part="header" /><Preview part="body" /></>}
                    </GtkBox>
                );
            };`;
        writeWidgetApp(project, readyPath, content(true));
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const [button] = await queryWidgets(client, { by: "role", value: "button", options: { name: "Open" } });
                const click = await callTool(client, "gtkx_click", { widgetId: button?.id });
                expect(click.isError).toBe(true);
                expect(click.text).not.toBe("");
                rmSync(readyPath);
                project.write("src/content.tsx", content(false));
                await expect.poll(() => existsSync(readyPath), { timeout: 30_000 }).toBe(true);
            });
        });
    });

    it("reports a signal handler's error from an MCP click like one from a real click, but not a misused tool", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import { GtkButton } from "@gtkx/jsx/gtk";
            export const Content = () => (
                <GtkButton label="Save" onClicked={() => { throw new Error("Saving the card failed"); }} />
            );`,
        );
        await withMcpClient(project.root, async (client) => {
            const session = spawn(
                process.execPath,
                [join(project.root, "node_modules/@gtkx/cli/bin/gtkx.js"), "dev", "--headless", "--size", "640x480"],
                {
                    cwd: project.root,
                    env: Object.fromEntries(
                        Object.entries(process.env).filter(
                            ([name]) => !name.startsWith("VITEST") && name !== "DISPLAY",
                        ),
                    ),
                },
            );
            let output = "";
            session.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
            session.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
            const exited = once(session, "exit");
            try {
                await expect.poll(() => existsSync(readyPath), { timeout: 60_000 }).toBe(true);
                const [button] = await queryWidgets(client, { by: "role", value: "button", options: { name: "Save" } });
                const misused = await callTool(client, "gtkx_type", { widgetId: button?.id, text: "typed" });
                expect(misused.isError).toBe(true);
                expect((await callTool(client, "gtkx_click", { widgetId: button?.id })).isError).toBe(true);
                await expect.poll(() => output, { timeout: 10_000 }).toContain("Saving the card failed");
                expect(output).not.toContain(misused.text);
            } finally {
                session.kill("SIGTERM");
                await exited;
            }
        });
    });

    it("names the widget ID a pointer reaches when an MCP click targets a widget it cannot", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
            import { useState } from "react";
            export const Content = () => {
                const [isArchived, setIsArchived] = useState(false);
                return (
                    <GtkButton onClicked={() => setIsArchived(true)}>
                        <GtkBox canTarget={false}>
                            <GtkLabel label={isArchived ? "Archived" : "Archive"} />
                        </GtkBox>
                    </GtkButton>
                );
            };`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const [label] = await queryWidgets(client, { by: "text", value: "Archive" });
                const refused = await callTool(client, "gtkx_click", { widgetId: label?.id });
                expect(refused.isError).toBe(true);
                expect(refused.text).toContain("a pointer there lands on <Button");
                const [, widgetId] = /widget ID is "(\d+)"/.exec(refused.text) ?? [];
                expect((await callTool(client, "gtkx_click", { widgetId })).isError).toBe(false);
                expect(await queryWidgets(client, { by: "text", value: "Archived" })).toHaveLength(1);
            });
        });
    });

    it("presses keys through MCP on a widget or the focused widget", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import { AdwAlertDialog } from "@gtkx/jsx/adw";
            import { GtkBox, GtkButton, GtkEntry, GtkLabel } from "@gtkx/jsx/gtk";
            import { useState } from "react";
            export const Content = () => {
                const [isOpen, setIsOpen] = useState(false);
                const [name, setName] = useState("");
                const [result, setResult] = useState("Waiting");
                return (
                    <GtkBox>
                        <GtkButton label="New Folder" onClicked={() => setIsOpen(true)} />
                        <GtkLabel label={result} />
                        {isOpen && (
                            <AdwAlertDialog
                                heading="New Folder"
                                defaultResponse="create"
                                closeResponse="cancel"
                                responses={[{ id: "cancel", label: "Cancel" }, { id: "create", label: "Create" }]}
                                onResponse={(id) => {
                                    setResult(id === "create" ? \`Created \${name}\` : "Cancelled");
                                    setIsOpen(false);
                                }}
                            >
                                <GtkEntry
                                    accessibleLabel="Folder name"
                                    activatesDefault
                                    onChanged={(entry) => setName(entry.getText())}
                                />
                            </AdwAlertDialog>
                        )}
                    </GtkBox>
                );
            };`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const openDialog = async () => {
                    const [button] = await queryWidgets(client, {
                        by: "role",
                        value: "button",
                        options: { name: "New Folder" },
                    });
                    await callTool(client, "gtkx_click", { widgetId: button?.id });
                    const [entry] = await queryWidgets(client, {
                        by: "role",
                        value: "text_box",
                        options: { name: "Folder name" },
                    });
                    return entry?.id;
                };
                const entryId = await openDialog();
                await callTool(client, "gtkx_type", { widgetId: entryId, text: "Invoices {2026}" });
                expect(
                    (await callTool(client, "gtkx_press_keys", { widgetId: entryId, keys: "{Enter}" })).isError,
                ).toBe(false);
                expect(await queryWidgets(client, { by: "text", value: "Created Invoices {2026}" })).toHaveLength(1);

                await openDialog();
                await callTool(client, "gtkx_press_keys", { keys: "{Escape}" });
                expect(await queryWidgets(client, { by: "text", value: "Cancelled" })).toHaveLength(1);
            });
        });
    });

    it("names the focusable ancestor when MCP keys target a widget that cannot take focus", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import { AdwActionRow, AdwEntryRow, AdwPreferencesGroup, AdwSwitchRow } from "@gtkx/jsx/adw";
            import { GtkLabel, GtkMenuButton, GtkPopover, GtkSearchEntry } from "@gtkx/jsx/gtk";
            export const Content = () => (
                <AdwPreferencesGroup headerSuffix={<GtkSearchEntry />}>
                    <AdwEntryRow title="Greeting" />
                    <AdwSwitchRow title="Show counter" />
                    <AdwActionRow
                        title="Due"
                        suffix={<GtkMenuButton label="Set date" popover={<GtkPopover><GtkLabel label="Calendar" /></GtkPopover>} />}
                    />
                </AdwPreferencesGroup>
            );`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const [entry] = await queryWidgets(client, {
                    by: "role",
                    value: "text_box",
                    options: { name: "Greeting" },
                });
                await callTool(client, "gtkx_type", { widgetId: entry?.id, text: "Hello" });
                const switches = await queryWidgets(client, {
                    by: "role",
                    value: "switch",
                    options: { name: "Show counter" },
                });
                const row = switches.find((widget) => widget.type !== "Switch");
                const inner = switches.find((widget) => widget.type === "Switch");

                const redirected = await callTool(client, "gtkx_press_keys", { widgetId: inner?.id, keys: "{Space}" });
                expect(redirected.text).toContain("The widget cannot take focus");
                expect(redirected.text).toContain(`press the keys on widget ID "${row?.id}"`);
                expect((await callTool(client, "gtkx_press_keys", { widgetId: row?.id, keys: "{Space}" })).text).toBe(
                    "Pressed keys",
                );
                expect((await callTool(client, "gtkx_press_keys", { widgetId: inner?.id, keys: "{Space}" })).text).toBe(
                    "Pressed keys",
                );
                const [search] = await queryWidgets(client, { by: "role", value: "search_box" });
                expect(
                    (await callTool(client, "gtkx_press_keys", { widgetId: search?.id, keys: "{Enter}" })).text,
                ).toBe("Pressed keys");
                const menus = await queryWidgets(client, {
                    by: "role",
                    value: "button",
                    options: { name: "Set date" },
                });
                const menu = menus.find((widget) => widget.type === "MenuButton");
                expect((await callTool(client, "gtkx_press_keys", { widgetId: menu?.id, keys: "{Enter}" })).text).toBe(
                    "Pressed keys",
                );
                const { text } = await callTool(client, "gtkx_get_widget_props", {
                    widgetId: menu?.id,
                    properties: ["active"],
                    maxDepth: 0,
                });
                expect(
                    (JSON.parse(text) as { properties: { active: { value: boolean } } }).properties.active.value,
                ).toBe(true);
            });
        });
    });

    it("picks a color chooser swatch with keys through MCP and says when a click or key did nothing", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import { GtkColorChooserWidget } from "@gtkx/jsx/gtk";
            export const Content = () => <GtkColorChooserWidget name="chooser" useAlpha={false} />;`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const [chooser] = await queryWidgets(client, { by: "name", value: "chooser" });
                const [red] = await queryWidgets(client, { by: "role", value: "radio", options: { name: "Red" } });
                const color = async () => {
                    const { text } = await callTool(client, "gtkx_get_widget_props", {
                        widgetId: chooser?.id,
                        properties: ["rgba"],
                        maxDepth: 0,
                    });
                    return (JSON.parse(text) as { properties: { rgba: { value: string } } }).properties.rgba.value;
                };
                const click = await callTool(client, "gtkx_click", { widgetId: red?.id });
                expect(click.isError).toBe(false);
                expect(click.text).not.toBe("Clicked");
                expect(await color()).toBe("rgb(255,255,255)");
                const ignored = await callTool(client, "gtkx_press_keys", { widgetId: red?.id, keys: "x" });
                expect(ignored.text).not.toBe("Pressed keys");
                expect((await callTool(client, "gtkx_press_keys", { widgetId: red?.id, keys: "{Space}" })).text).toBe(
                    "Pressed keys",
                );
                expect(await color()).toBe("rgb(224,27,36)");
            });
        });
    });

    it("presses right and middle pointer buttons through MCP on the gestures listening for them", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import * as Gdk from "@gtkx/gi/gdk";
            import { GtkBox, GtkGestureClick, GtkLabel } from "@gtkx/jsx/gtk";
            import { useState } from "react";
            export const Content = () => {
                const [events, setEvents] = useState<string[]>([]);
                const record = (event: string) => setEvents((previous) => [...previous, event]);
                return (
                    <GtkBox
                        controllers={
                            <>
                                <GtkGestureClick
                                    button={Gdk.BUTTON_SECONDARY}
                                    onPressed={() => record("menu")}
                                    onReleased={() => record("menu released")}
                                />
                                <GtkGestureClick button={Gdk.BUTTON_MIDDLE} onPressed={() => record("paste")} />
                            </>
                        }
                    >
                        <GtkLabel label="Habit" />
                        <GtkLabel label={events.join(", ") || "Idle"} />
                    </GtkBox>
                );
            };`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                const [habit] = await queryWidgets(client, { by: "text", value: "Habit" });
                expect(await callTool(client, "gtkx_pointer", { widgetId: habit?.id, input: "[MouseRight>]" })).toEqual(
                    { isError: false, text: "Applied [MouseRight>]" },
                );
                expect(await queryWidgets(client, { by: "text", value: "menu" })).toHaveLength(1);
                await callTool(client, "gtkx_pointer", { widgetId: habit?.id, input: "[/MouseRight]" });
                await callTool(client, "gtkx_pointer", { widgetId: habit?.id, input: "[MouseMiddle]" });
                expect(await queryWidgets(client, { by: "text", value: "menu, menu released, paste" })).toHaveLength(1);

                const unknown = await callTool(client, "gtkx_pointer", { widgetId: habit?.id, input: "[MouseBack]" });
                expect(unknown.isError).toBe(true);
                expect(unknown.text).toContain('Unknown pointer input "[MouseBack]"');
                expect(
                    (await callTool(client, "gtkx_pointer", { widgetId: habit?.id, input: "[MouseRight]", x: 4 }))
                        .isError,
                ).toBe(true);
            });
        });
    });

    it("reloads imported configuration after atomic saves and missing directories are created", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"] });
        const readyPath = join(project.root, "ready.txt");
        const attemptedPath = join(project.root, "attempted.txt");
        const config = readFileSync(join(project.root, "gtkx.config.ts"), "utf8");
        project.write(
            "gtkx.config.ts",
            `import { applicationId } from "./settings.ts";\n${config.replace('"org.gtkx.example"', "applicationId")}`,
        );
        const settings = (applicationId: string) => `export const applicationId = ${JSON.stringify(applicationId)};`;
        project.write("settings.ts", settings("org.gtkx.initial"));
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { applicationId } from "virtual:gtkx-config";
            import { writeFileSync } from "node:fs";
            export const application = new Application({ applicationId });
            application.setDefault();
            application.register(null);
            application.hold();
            writeFileSync(${JSON.stringify(readyPath)}, applicationId);`,
        );

        await withSession("dev", project.root, readyPath, async () => {
            expect(readFileSync(readyPath, "utf8")).toBe("org.gtkx.initial");
            project.write("settings.tmp", settings("org.gtkx.atomic"));
            renameSync(join(project.root, "settings.tmp"), join(project.root, "settings.ts"));
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("org.gtkx.atomic");

            project.write(
                "gtkx.config.ts",
                `import { writeFileSync } from "node:fs";
                export default async () => {
                    writeFileSync(${JSON.stringify(attemptedPath)}, "attempted");
                    const { applicationId } = await import("./generated/nested/settings.js");
                    ${config.replace("export default", "return").replace('"org.gtkx.example"', "applicationId")}
                };`,
            );
            await expect.poll(() => existsSync(attemptedPath), { timeout: 30_000 }).toBe(true);
            expect(readFileSync(readyPath, "utf8")).toBe("org.gtkx.atomic");
            project.write("generated/nested/settings.ts", settings("org.gtkx.recovered"));
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("org.gtkx.recovered");

            project.write("generated/nested/settings.ts", settings("org.gtkx.updated"));
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("org.gtkx.updated");

            rmSync(join(project.root, "generated/nested"), { recursive: true });
            await setTimeout(20);
            project.write("generated/nested/settings.ts", settings("org.gtkx.recreated"));
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("org.gtkx.recreated");

            project.write("generated/nested/settings.ts", settings("org.gtkx.latest"));
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("org.gtkx.latest");
        });
    });

    it("regenerates bindings and restarts when GIR files of declared libraries change", async () => {
        using project = createProject({ codegen: true, libraries: ["Probe-1.0"], girPath: ["gir"] });
        const readyPath = join(project.root, "ready.txt");
        const launchesPath = join(project.root, "launches.txt");
        const gir = (functions: string[], namespace = "Probe") => `<?xml version="1.0"?>
            <repository version="1.0" xmlns="http://www.gtk.org/introspection/core/1.0"
              xmlns:c="http://www.gtk.org/introspection/c/1.0" xmlns:glib="http://www.gtk.org/introspection/glib/1.0">
              <include name="GLib" version="2.0"/>
              <namespace name="${namespace}" version="1.0" shared-library="libglib-2.0.so.0" c:prefix="G">
                ${functions
                    .map(
                        (name) => `<function name="${name}" c:identifier="g_get_${name}">
                          <return-value transfer-ownership="none"><type name="utf8"/></return-value>
                        </function>`,
                    )
                    .join("\n")}
              </namespace>
            </repository>`;
        project.write("gir/Probe-1.0.gir", gir(["user_name"]));
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import * as Probe from "@gtkx/gi/probe";
            import { appendFileSync, writeFileSync } from "node:fs";
            export const application = new Application({ applicationId: "org.gtkx.example" });
            application.setDefault();
            application.register(null);
            application.hold();
            appendFileSync(${JSON.stringify(launchesPath)}, "x");
            writeFileSync(${JSON.stringify(readyPath)}, typeof Probe.hostName);`,
        );

        await withSession("dev", project.root, readyPath, async () => {
            expect(readFileSync(readyPath, "utf8")).toBe("undefined");
            project.write("gir/Probe-1.0.gir", gir(["user_name", "host_name"]));
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("function");
            expect(readFileSync(launchesPath, "utf8")).toBe("xx");

            project.write("gir/Extra-1.0.gir", gir(["user_name"], "Extra"));
            project.write(
                "gtkx.config.ts",
                readFileSync(join(project.root, "gtkx.config.ts"), "utf8").replace(
                    '"Probe-1.0"',
                    '"Probe-1.0","Extra-1.0"',
                ),
            );
            await expect.poll(() => readFileSync(launchesPath, "utf8"), { timeout: 30_000 }).toBe("xxx");
            project.write("gir/Extra-1.0.gir", gir(["user_name", "host_name"], "Extra"));
            await expect.poll(() => readFileSync(launchesPath, "utf8"), { timeout: 30_000 }).toBe("xxxx");
        });

        project.write("gir/Probe-1.0.gir", gir(["user_name", "host_name", "real_name"]));
        expect(await invoke(["build", "--cwd", project.root])).toContain("generated bindings out of date");
    });

    it("restarts with the reinstalled dependency when the lockfile changes", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const install = (version: string) => {
            project.write(
                "node_modules/clock-format/package.json",
                JSON.stringify({ name: "clock-format", version, type: "module", exports: "./index.js" }),
            );
            project.write("node_modules/clock-format/index.js", `export const version = ${JSON.stringify(version)};`);
            project.write(
                "package-lock.json",
                JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/clock-format": { version } } }),
            );
        };
        install("1.0.0");
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { version } from "clock-format";
            import { writeFileSync } from "node:fs";
            export const application = new Application({ applicationId: "org.gtkx.example" });
            application.setDefault();
            application.register(null);
            application.hold();
            writeFileSync(${JSON.stringify(readyPath)}, version);`,
        );

        await withSession("dev", project.root, readyPath, async () => {
            expect(readFileSync(readyPath, "utf8")).toBe("1.0.0");
            install("2.0.0");
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("2.0.0");
        });
    });

    it("keeps running through an install that leaves the GTKX packages unresolvable for a while", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const launchesPath = join(project.root, "launches.txt");
        const runtime = join(project.root, "node_modules/@gtkx/runtime");
        const lock = (step: number) =>
            project.write("package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: {}, step }));
        lock(0);
        project.write(
            "src/index.ts",
            `import { Application } from "@gtkx/gi/gio";
            import { appendFileSync, writeFileSync } from "node:fs";
            export const application = new Application({ applicationId: "org.gtkx.example" });
            application.setDefault();
            application.register(null);
            application.hold();
            appendFileSync(${JSON.stringify(launchesPath)}, "x");
            writeFileSync(${JSON.stringify(readyPath)}, "ready");`,
        );

        await withSession("dev", project.root, readyPath, async () => {
            renameSync(runtime, `${runtime}.moving`);
            lock(1);
            await setTimeout(1000);
            renameSync(`${runtime}.moving`, runtime);
            lock(2);
            await expect.poll(() => readFileSync(launchesPath, "utf8"), { timeout: 30_000 }).toBe("xx");
        });
    });

    it("starts a real storybook session and stops its application", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const previewPath = join(project.root, "preview.txt");
        project.write(".storybook/paths.mts", 'export const stories = ["stories/**/*.stories.tsx"];');
        project.write(".storybook/main.mts", 'import { stories } from "./paths.mjs"; export default { stories };');
        project.write(
            ".storybook/preview.tsx",
            `import { writeFileSync } from "node:fs";
            writeFileSync(${JSON.stringify(previewPath)}, "preview");
            export default { decorators: [(Story) => <Story />] };`,
        );
        const badge = (text: string) => `
            import { Label } from "@gtkx/gi/gtk";
            import { registerClass } from "@gtkx/runtime";
            class BadgeBase extends Label {}
            export const Badge = registerClass(BadgeBase, { typeName: "StoryBadge" });
            export const badgeText = ${JSON.stringify(text)};
        `;
        project.write("stories/badge.ts", badge("one"));
        project.write(
            "stories/example.stories.tsx",
            `import { writeFileSync } from "node:fs";
            import { badgeText } from "./badge.ts";
            writeFileSync(${JSON.stringify(readyPath)}, JSON.stringify({ pid: process.pid, badgeText }));
            export default { title: "Example" }; export const Empty = { render: () => null };`,
        );
        const observation = () => JSON.parse(readFileSync(readyPath, "utf8")) as { pid: number; badgeText: string };
        await withSession("storybook", project.root, readyPath, async () => {
            const initial = observation();
            expect(initial.badgeText).toBe("one");
            expect(readFileSync(previewPath, "utf8")).toBe("preview");

            project.write("stories/badge.ts", badge("two"));
            await expect.poll(() => observation().badgeText, { timeout: 30_000 }).toBe("two");
            expect(observation().pid).not.toBe(initial.pid);
        });
    });

    it("skips MDX files matched by storybook patterns with a warning", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "ready.txt");
        const mdxPath = join(project.root, "mdx.txt");
        project.write(
            ".storybook/main.mts",
            'export default { stories: ["stories/**/*.mdx", "stories/**/*.stories.tsx"] };',
        );
        project.write(
            ".storybook/preview.tsx",
            `import { writeFileSync } from "node:fs";
            export default { decorators: [(Story) => { writeFileSync(${JSON.stringify(readyPath)}, "ready"); return <Story />; }] };`,
        );
        project.write(
            "stories/introduction.mdx",
            `import { writeFileSync } from "node:fs";
            writeFileSync(${JSON.stringify(mdxPath)}, "loaded");
            export default { title: "Introduction" }; export const Docs = { render: () => null };`,
        );
        project.write(
            "stories/example.stories.tsx",
            'export default { title: "Example" }; export const Empty = { render: () => null };',
        );

        const output = await withSession("storybook", project.root, readyPath, () => Promise.resolve());

        expect(existsSync(mdxPath)).toBe(false);
        expect(output).toContain("introduction.mdx");
    });

    it("lists and reloads storybook stories of a sibling workspace package", async () => {
        using project = createProject({ codegen: true });
        const app = "workspace/apps/timer";
        const readyPath = join(project.root, "ready.txt");
        const dependencyPath = join(project.root, "dependency.txt");
        project.write("workspace/pnpm-workspace.yaml", "packages:\n  - apps/*\n  - packages/*\n");
        project.write(`${app}/package.json`, JSON.stringify({ name: "timer", type: "module" }));
        project.write(
            `${app}/gtkx.config.ts`,
            'export default { applicationId: "org.gtkx.timer", agents: { reference: false, rules: false } };',
        );
        project.write(
            `${app}/.storybook/main.mts`,
            'export default { stories: ["src/**/*.stories.tsx", "../../packages/ui/**/*.stories.tsx"] };',
        );
        const tone = "workspace/packages/ui/src/tone.ts";
        project.write(tone, 'export const tone = "accent";');
        project.write(
            "workspace/packages/ui/src/badge.stories.tsx",
            `import { writeFileSync } from "node:fs";
            import { tone } from "./tone.ts";
            writeFileSync(${JSON.stringify(readyPath)}, tone);
            export default { title: "Badge" }; export const Empty = { render: () => null };`,
        );
        project.write(
            "workspace/packages/ui/node_modules/kit/src/kit.stories.tsx",
            `import { writeFileSync } from "node:fs";
            writeFileSync(${JSON.stringify(dependencyPath)}, "kit");
            export default { title: "Kit" }; export const Empty = { render: () => null };`,
        );

        const session = spawn(
            process.execPath,
            [
                join(project.root, "node_modules/@gtkx/cli/bin/gtkx.js"),
                "storybook",
                "--cwd",
                join(project.root, app),
                "--headless",
                "--size",
                "640x480",
            ],
            {
                cwd: project.root,
                env: Object.fromEntries(
                    Object.entries(process.env).filter(([name]) => !name.startsWith("VITEST") && name !== "DISPLAY"),
                ),
            },
        );
        let output = "";
        session.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
        session.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
        const exited = once(session, "exit");
        try {
            await expect
                .poll(() => existsSync(readyPath) && readFileSync(readyPath, "utf8"), { timeout: 60_000 })
                .toBe("accent");
            project.write(tone, 'export const tone = "warning";');
            await expect.poll(() => readFileSync(readyPath, "utf8"), { timeout: 30_000 }).toBe("warning");
            await expect.poll(() => output).toContain("Stories reloaded");
            expect(output).toContain(`File changed: ${join(realpathSync(project.root), tone)}`);
        } finally {
            session.kill("SIGTERM");
            await exited;
        }

        expect(existsSync(dependencyPath)).toBe(false);
    });

    it("rejects storybook stories outside the workspace root", async () => {
        using project = createProject();
        const app = join(project.root, "workspace/apps/timer");
        project.write("workspace/pnpm-workspace.yaml", "packages:\n  - apps/*\n");
        project.write("workspace/apps/timer/package.json", JSON.stringify({ name: "timer", type: "module" }));
        project.write(
            "workspace/apps/timer/.storybook/main.mts",
            'export default { stories: ["../../../shared/**/*.stories.tsx"] };',
        );
        project.write(
            "shared/badge.stories.tsx",
            'export default { title: "Badge" }; export const Empty = { render: () => null };',
        );

        await expect(invoke(["storybook", "--cwd", app])).rejects.toThrow("inside the workspace root");
    });

    it.each([
        {
            name: "an application",
            config: { applicationId: "org.gtkx.example" },
            explorer: "org.gtkx.example.Storybook",
        },
        { name: "a component library", config: {}, explorer: "org.gtkx.Library.Storybook" },
    ])(
        "registers the storybook explorer of $name with MCP under its own application ID",
        async ({ config, explorer }) => {
            using project = createProject({ codegen: true });
            project.write("gtkx.config.ts", `export default ${JSON.stringify({ ...config, codegen: true })};`);
            const readyPath = join(project.root, "ready.txt");
            project.write(".storybook/main.mts", 'export default { stories: ["stories/**/*.stories.tsx"] };');
            project.write(
                "stories/example.stories.tsx",
                `import { writeFileSync } from "node:fs";
            writeFileSync(${JSON.stringify(readyPath)}, "ready");
            export default { title: "Example" }; export const Empty = { render: () => null };`,
            );
            await withMcpClient(project.root, async (client) => {
                await withSession("storybook", project.root, readyPath, async () => {
                    const apps = await client.callTool({
                        name: "gtkx_list_apps",
                        arguments: { waitForApps: true, timeout: 30_000 },
                    });
                    expect(JSON.stringify(apps)).toContain(explorer);
                });
            });
        },
    );

    it("reports actionable deployment configuration errors", async () => {
        using project = createProject();
        await expect(invoke(["deploy", "--cwd", project.root, "--print-manifests"])).rejects.toThrow("deploy");
    });

    it.each(["dev", "storybook"])("validates %s headless arguments before starting a session", async (name) => {
        using project = createProject();
        const controller = new AbortController();
        await expect(
            invoke([name, "--cwd", project.root, "--size", "640x480"], createCommand({ signal: controller.signal })),
        ).rejects.toThrow("--headless");
    });
});
