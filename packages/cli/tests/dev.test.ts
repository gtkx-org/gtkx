import { resolveHeadlessOptions, startHeadlessDisplay } from "@gtkx/vitest/headless";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import {
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
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVitest } from "vitest/node";
import { createPnpmWorkspace, createProject } from "./project.js";
import { invoke, withSession, withMcpClient, queryWidgets } from "./invoke.js";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("gtkx dev", () => {
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
            .cli-css-probe { color: @cli_css_probe; min-width: 231px; background-image: url("../../data/probe.png"); }
            .cli-css-absolute { background-image: url("/org/gtkx/cssprobe/absolute.png"); }`,
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
        const output = await invoke(["build", "--cwd", project.root]);
        expect(output.split("\n").filter((line) => line.includes("/org/gtkx/cssprobe/absolute.png"))).toHaveLength(1);
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

    it("runs workers with asset imports in development, tests and production, restarts for their edits and rejects web worker imports", async () => {
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
            import stylesheet from "../../data/page.css?inline";
            parentPort?.postMessage({ path: notesPath, text: readFileSync(notesPath, "utf8"), raw: notes, inline: notesData, stylesheet, label });`;
        writeFileSync(
            join(shared.path, "package.json"),
            JSON.stringify({ name: "@example/shared", type: "module", exports: "./index.ts" }),
        );
        writeFileSync(sharedPath, 'export const label = "shared";');
        mkdirSync(join(project.root, "node_modules/@example"));
        symlinkSync(shared.path, join(project.root, "node_modules/@example/shared"), "dir");
        project.write("data/notes.txt", "worker asset");
        project.write("data/page.css", "body { color: red; }\n");
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
                    stylesheet: "body { color: red; }\\n",
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
                stylesheet: "body { color: red; }\n",
                label: "shared",
            });
            project.write("data/notes.txt", "edited asset");
            await expect.poll(result, { timeout: 30_000 }).toEqual({
                path: sourcePath,
                text: "edited asset",
                raw: "edited asset",
                inline: "data:text/plain;base64,ZWRpdGVkIGFzc2V0",
                stylesheet: "body { color: red; }\n",
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
        expect(result().stylesheet).toBe("body { color: red; }\n");
        expect(result().label).toBe("shared");
        expect(result().path).toMatch(new RegExp(`^${RegExp.escape(join(project.root, "dist"))}/`));

        for (const query of ["worker", "sharedworker"]) {
            project.write("src/index.ts", `import ReadWorker from "./workers/read.ts?${query}";\nnew ReadWorker();`);
            await expect(invoke(["build", "--cwd", project.root])).rejects.toThrow();
        }
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

    it("restarts the application when a saved edit changes a construct-only prop", async () => {
        using project = createProject({ codegen: true });
        const readyPath = join(project.root, "probe.json");
        const app = (strings: string[]) => `
            import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { GtkDropDown, GtkStringList } from "@gtkx/jsx/gtk";
            import { writeFileSync } from "node:fs";
            export function App() {
                return (
                    <AdwApplication applicationId="org.gtkx.example">
                        <AdwApplicationWindow>
                            <GtkDropDown
                                model={<GtkStringList strings={${JSON.stringify(strings)}} />}
                                onMap={(dropDown) => writeFileSync(${JSON.stringify(readyPath)}, JSON.stringify({
                                    pid: process.pid,
                                    first: dropDown.getModel()?.getString(0),
                                }))}
                            />
                        </AdwApplicationWindow>
                    </AdwApplication>
                );
            }`;
        project.write("src/app.tsx", app(["first"]));
        project.write(
            "src/index.tsx",
            `import { createRoot } from "@gtkx/react";
            import { App } from "./app.tsx";
            createRoot().render(<App />);`,
        );
        const observation = () => JSON.parse(readFileSync(readyPath, "utf8")) as { pid: number; first: string };
        await withSession("dev", project.root, readyPath, async () => {
            const initial = observation();
            expect(initial.first).toBe("first");
            project.write("src/app.tsx", app(["edited"]));
            await expect.poll(() => observation().first, { timeout: 30_000 }).toBe("edited");
            expect(observation().pid).not.toBe(initial.pid);
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
                execFileSync(process.execPath, [${JSON.stringify(workspace.cli("editor"))}, "codegen"], {
                    cwd: ${JSON.stringify(appDir("editor"))},
                });
                writeFileSync(${JSON.stringify(regenerated)}, "");
            }`,
        );
        workspace.write(
            "apps/editor/gtkx.config.ts",
            `export default ${JSON.stringify({ agents: { reference: false, rules: false }, applicationId: "org.gtkx.editor", codegen: true })};`,
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
});
