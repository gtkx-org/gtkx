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
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    symlinkSync,
} from "node:fs";
import { join, relative } from "node:path";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
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
    return (JSON.parse(text) as { widgets: { id: string; name: string | null }[] }).widgets;
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

    it("applies imported CSS in development and production", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "style.txt");
        project.write(
            "src/theme.css",
            "@define-color cli_css_probe rgb(3, 6, 9); .cli-css-probe { color: @cli_css_probe; min-width: 231px; }",
        );
        project.write(
            "src/index.tsx",
            `import "./theme.css";
            import * as Gtk from "@gtkx/gi/gtk";
            import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { GtkLabel } from "@gtkx/jsx/gtk";
            import { createRoot } from "@gtkx/react";
            import { writeFileSync } from "node:fs";
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.cssprobe">
                    <AdwApplicationWindow>
                        <GtkLabel label="Probe" cssClasses={["cli-css-probe"]} onMap={(label) => {
                            setTimeout(() => {
                                const [width] = label.measure(Gtk.Orientation.HORIZONTAL, -1);
                                writeFileSync(${JSON.stringify(readyPath)}, String(width));
                                if (process.env.NODE_ENV === "production") process.exit(0);
                            }, 100);
                        }} />
                    </AdwApplicationWindow>
                </AdwApplication>
            );`,
        );
        const width = () => Number(readFileSync(readyPath, "utf8"));
        await withSession("dev", project.root, readyPath, async () => {
            await expect.poll(width, { timeout: 30_000 }).toBe(231);
        });
        rmSync(readyPath);
        await invoke(["build", "--cwd", project.root]);
        const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
        try {
            await promisify(execFile)(process.execPath, [join(project.root, "dist/bundle.mjs")], { timeout: 30_000 });
            expect(width()).toBe(231);
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
        const readyPath = join(project.root, "worker.json");
        const sourcePath = join(project.root, "data/notes.txt");
        const workerSource = `import { readFileSync } from "node:fs";
            import { parentPort } from "node:worker_threads";
            import notesPath from "../../data/notes.txt?url";
            import notes from "../../data/notes.txt?raw";
            parentPort?.postMessage({ path: notesPath, text: readFileSync(notesPath, "utf8"), raw: notes });`;
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
            await expect.poll(result).toEqual({ path: sourcePath, text: "worker asset", raw: "worker asset" });
            project.write("data/notes.txt", "edited asset");
            await expect.poll(result, { timeout: 30_000 }).toEqual({
                path: sourcePath,
                text: "edited asset",
                raw: "edited asset",
            });
            project.write("data/notes.txt", "worker asset");
            await expect.poll(result, { timeout: 30_000 }).toMatchObject({ raw: "worker asset" });
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

    it("renders elements from a linked workspace package built against @gtkx/react", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "kit.txt");
        project.write(
            "package.json",
            JSON.stringify({ name: "cli-example", version: "1.0.0", type: "module", dependencies: { kit: "*" } }),
        );
        project.write(
            "packages/kit/package.json",
            JSON.stringify({
                name: "kit",
                type: "module",
                exports: "./index.js",
                peerDependencies: { "@gtkx/react": "*" },
            }),
        );
        project.write(
            "packages/kit/index.js",
            `import { GtkLabel } from "@gtkx/jsx/gtk";
            import { jsx } from "react/jsx-runtime";
            export const Badge = (props) => jsx(GtkLabel, props);`,
        );
        symlinkSync(join(project.root, "packages/kit"), join(project.root, "node_modules/kit"), "dir");
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
        const writeApp = (app: string, label: string, imports = "") => {
            mkdirSync(join(appDir(app), "node_modules/@studio"), { recursive: true });
            symlinkSync(join(workspace.root, "packages/ui"), join(appDir(app), "node_modules/@studio/ui"), "dir");
            workspace.write(
                `apps/${app}/package.json`,
                JSON.stringify({ name: app, type: "module", dependencies: { "@studio/ui": "workspace:*" } }),
            );
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
        workspace.write(
            "apps/editor/vitest.config.mjs",
            `import gtkx from "@gtkx/cli/vitest-plugin";
            export default { plugins: [gtkx()], test: { include: ["tests/*.test.tsx"] } };`,
        );
        workspace.write(
            "apps/editor/tests/badge.test.tsx",
            `import * as GtkSource from "@gtkx/gi/gtksource";
            import { render, screen } from "@gtkx/testing";
            import { Badge } from "@studio/ui";
            import { expect, test } from "vitest";
            test("renders the shared badge next to source bindings", async () => {
                await render(<Badge label="shared" />);
                expect(await screen.findByText("shared")).toBeTruthy();
                expect(new GtkSource.Buffer().getLanguage()).toBeNull();
            });`,
        );
        const run = (app: string, args: string[], timeout = 180_000) =>
            promisify(execFile)(process.execPath, args, {
                cwd: appDir(app),
                env: childEnv(),
                timeout,
                killSignal: "SIGKILL",
            });

        workspace.write(
            "apps/editor/tsconfig.json",
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
        await run("editor", [workspace.cli("editor"), "codegen"]);
        await promisify(execFile)(workspace.tsc, ["-p", appDir("editor")], { env: childEnv(), timeout: 180_000 });

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
        const session = spawn(process.execPath, [workspace.cli("journal"), "dev", "--headless", "--size", "640x480"], {
            cwd: appDir("journal"),
            env: childEnv(),
        });
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
            expect(readFileSync(readyPath("journal"), "utf8")).toBe("journal");
        } finally {
            session.kill("SIGTERM");
            await exited;
        }
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
        expect(await invoke(["codegen", "--cwd", project.root])).toContain("codegen");
        expect(existsSync(join(project.root, "node_modules/@gtkx/gi/gio/index.d.ts"))).toBe(true);
        await invoke(["docs", "--cwd", project.root, "--out", "reference"]);
        const files = readdirSync(join(project.root, "reference"), { recursive: true });
        expect(files.some((file) => file.toString().endsWith(".md"))).toBe(true);
        await expect(invoke(["docs", "--cwd", project.root, "--out", "../outside"])).rejects.toThrow("below");
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
        project.write(".mcp.json", '{"mcpServers":{"other":{"command":"other"}}}');
        await invoke(["mcp", "init", "--cwd", project.root, "--client", "claude"]);
        expect(JSON.parse(readFileSync(join(project.root, ".mcp.json"), "utf8"))).toMatchObject({
            mcpServers: { other: { command: "other" }, gtkx: { command: "npx", args: ["gtkx", "mcp"] } },
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
            },
        });
        project.write("LICENSE", "MIT License\nCopyright GTKX\nPermission is hereby granted, free of charge.\n");
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
        await invoke(["deploy", "--cwd", project.root, "--print-manifests", "--target", "appimage,deb,flatpak,rpm"]);
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

    it("renders a source Flatpak that installs with pnpm 12's native binary and keeps workers and translations", async () => {
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
        const localeConfig = module?.sources.find((source) => source["dest-filename"] === "gtkx-i18n.json");
        expect(JSON.parse(String(localeConfig?.contents))).toEqual({ localeDir: "../../share/locale" });
        expect(
            module?.["build-commands"].some((command) =>
                command.endsWith("gtkx-i18n.json ${FLATPAK_DEST}/lib/cli-example/gtkx-i18n.json"),
            ),
        ).toBe(true);
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
        await withSession("dev", project.root, failedPath, async () => {
            project.write("src/index.tsx", entry(`writeFileSync(${JSON.stringify(readyPath)}, "ready");`));
            await expect.poll(() => existsSync(readyPath), { timeout: 30_000 }).toBe(true);
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
            });
        });
    });

    it("summarizes widgets by their accessible name", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        writeWidgetApp(
            project,
            readyPath,
            `import { GtkButton } from "@gtkx/jsx/gtk";
            export const Content = () => <GtkButton iconName="list-add-symbolic" tooltipText="New Note" />;`,
        );
        await withMcpClient(project.root, async (client) => {
            await withSession("dev", project.root, readyPath, async () => {
                expect(await queryWidgets(client, { by: "role", value: "button" })).toEqual([
                    expect.objectContaining({ type: "Button", name: "New Note" }),
                ]);
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

    it("registers the storybook explorer with MCP under its own application ID", async () => {
        using project = createProject({ codegen: true });
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
                expect(JSON.stringify(apps)).toContain("org.gtkx.example.Storybook");
            });
        });
    });

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
