import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProject, linkWorkspaceBindings } from "./project.js";
import { invoke, withSession, withMcpClient, callTool, queryWidgets } from "./invoke.js";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("gtkx storybook", () => {
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

    it("reopens the selected story when the storybook runner restarts", async () => {
        using project = createProject();
        linkWorkspaceBindings(project.root);
        const readyPath = join(project.root, "ready.txt");
        const shownPath = join(project.root, "shown.txt");
        project.write(".storybook/main.mts", 'export default { stories: ["stories/**/*.stories.tsx"] };');
        const badge = (text: string) => `
            import { Label } from "@gtkx/gi/gtk";
            import { registerClass } from "@gtkx/runtime";
            class BadgeBase extends Label {}
            export const Badge = registerClass(BadgeBase, { typeName: "SelectionBadge" });
            export const badgeText = ${JSON.stringify(text)};
        `;
        project.write("stories/badge.ts", badge("one"));
        project.write(
            "stories/example.stories.tsx",
            `import { writeFileSync } from "node:fs";
            import { badgeText } from "./badge.ts";
            writeFileSync(${JSON.stringify(readyPath)}, badgeText);
            const shown = (name) => () => { writeFileSync(${JSON.stringify(shownPath)}, name + ":" + badgeText); return null; };
            export default { title: "Example" };
            export const First = { render: shown("first") };
            export const Second = { render: shown("second") };`,
        );
        const shown = () => existsSync(shownPath) && readFileSync(shownPath, "utf8");
        await withMcpClient(project.root, async (client) => {
            await withSession("storybook", project.root, readyPath, async () => {
                await expect.poll(shown, { timeout: 30_000 }).toBe("first:one");
                const [second] = await queryWidgets(client, {
                    by: "role",
                    value: "list_item",
                    options: { name: "Second" },
                });
                await callTool(client, "gtkx_click", { widgetId: second?.id });
                await expect.poll(shown, { timeout: 30_000 }).toBe("second:one");

                project.write("stories/badge.ts", badge("two"));
                await expect.poll(shown, { timeout: 30_000 }).toBe("second:two");
            });
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
});
