import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli } from "./cli-project.js";
import { startStorybookSession } from "./storybook-session.js";

const CONFIG = 'export default { applicationId: "org.gtkx.storybookprobe", codegen: false };';
const MAIN = 'import { defineConfig } from "@gtkx/storybook/config";\n' +
    'export default defineConfig({ stories: ["src/**/*.stories.tsx"], exclude: ["**/excluded/**"] });';
const COMPONENT = "src/Counter.tsx";
const STORY = "src/Counter.stories.tsx";
const SECOND_STORY = "src/Other.stories.tsx";
const PREVIEW = ".storybook/preview.tsx";

const counter = (revision: string): string => `
import { GtkButton } from "@gtkx/jsx/gtk";
import { useState } from "react";
export const Counter = ({ step = 1 }) => {
    const [count, setCount] = useState(0);
    return <GtkButton label={${JSON.stringify(revision)} + ": " + count + " step " + step}
        onClicked={() => setCount(count + step)} />;
};
`;

const story = (step: number): string => `
import { Counter } from "./Counter";
export default { component: Counter, args: { step: ${String(step)} } };
export const Default = {};
export const Large = { args: { step: 10 } };
`;

const otherStory = (title = "Other", exportName = "Example"): string => `
import { GtkButton } from "@gtkx/jsx/gtk";
export default { title: ${JSON.stringify(title)}, render: () => <GtkButton label="Another preview" /> };
export const ${exportName} = {};
`;

const preview = (label: string): string => `
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
export default { decorators: [(Story) => <GtkBox><GtkLabel label=${JSON.stringify(label)} /><Story /></GtkBox>] };
`;

const projectFiles = (): Record<string, string> => ({
    ".storybook/main.ts": MAIN,
    [COMPONENT]: counter("Counter"),
    [STORY]: story(1),
    [SECOND_STORY]: otherStory(),
    "src/excluded/Ignored.stories.tsx": "this is invalid source",
});

const closeStories = {
    content: otherStory(),
    window: `
import { AdwWindow } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
export default { title: "Window", parameters: { gtkx: { preview: "window" } } };
export const Example = { render: () => <AdwWindow title="Story window"><GtkLabel>Story content</GtkLabel></AdwWindow> };
`,
    failing: `
export default { title: "Broken", render: () => { throw new Error("Broken story"); } };
export const Example = {};
`,
};

describe("gtkx storybook", () => {
    it.each(Object.entries(closeStories))("exits after closing the explorer with a %s story", async (mode, source) => {
        using project = createCliProject({
            prefix: "gtkx-storybook-close-",
            config: CONFIG,
            files: { "src/Close.stories.tsx": source },
            hasStore: true,
            shouldShareStore: true,
        });
        await using session = await startStorybookSession(project);
        const pid = await session.applicationPid();
        await session.waitForWidget("role", "window", { name: "GTKX Storybook" });

        if (mode === "window") {
            await session.waitForWidget("role", "window", { name: "Story window" });
        } else if (mode === "failing") {
            await session.waitForWidget("name", "storybook-preview-error");
        }

        await session.click("role", "button", { name: "Close" });
        await expect.poll(() => session.child.exitCode, { timeout: 15_000 }).toBe(0);
        expect(() => process.kill(pid, 0)).toThrow();
    });

    it("discovers native stories, reloads metadata and components, and updates added and removed modules", async () => {
        using project = createCliProject({
            prefix: "gtkx-storybook-dev-",
            config: CONFIG,
            files: projectFiles(),
            hasStore: true,
            shouldShareStore: true,
        });
        await using session = await startStorybookSession(project);
        const pid = await session.applicationPid();
        await session.waitForWidget("name", "storybook-story-counter--default");
        await session.waitForWidget("name", "storybook-story-other--example");
        await session.click("role", "button", { name: "Counter: 0 step 1" });
        await session.waitForWidget("role", "button", { name: "Counter: 1 step 1" });

        writeFileSync(join(project.root, COMPONENT), counter("Refreshed"));
        await session.waitForWidget("role", "button", { name: "Refreshed: 1 step 1" });
        expect(await session.applicationPid()).toBe(pid);

        writeFileSync(join(project.root, STORY), story(3));
        await session.waitForWidget("role", "button", { name: "Refreshed: 0 step 3" });
        await session.click("role", "button", { name: "Refreshed: 0 step 3" });
        await session.waitForWidget("role", "button", { name: "Refreshed: 3 step 3" });

        const added = join(project.root, "src/Added.stories.tsx");
        writeFileSync(added, otherStory("Added"));
        await session.waitForWidget("name", "storybook-story-added--example");
        await session.waitForWidget("role", "button", { name: "Refreshed: 3 step 3" });
        renameSync(added, join(project.root, "src/Renamed.stories.tsx"));
        await session.waitForWidget("name", "storybook-story-added--example");
        rmSync(join(project.root, "src/Renamed.stories.tsx"));
        await session.waitForAbsent("name", "storybook-story-added--example");
        await session.waitForWidget("role", "button", { name: "Refreshed: 3 step 3" });

        writeFileSync(join(project.root, PREVIEW), preview("Project decorator"));
        await session.waitForWidget("text", "Project decorator");
        writeFileSync(join(project.root, PREVIEW), preview("Updated decorator"));
        await session.waitForWidget("text", "Updated decorator");
        const settings = join(project.root, "src/settings.ts");
        writeFileSync(settings, "export const step = 6;");
        writeFileSync(join(project.root, STORY),
            'import { step } from "./settings";\n' + story(3).replace("{ step: 3 }", "{ step }"));
        await session.waitForWidget("role", "button", { name: "Refreshed: 0 step 6" });
        writeFileSync(settings, "export const step = 9;");
        await session.waitForWidget("role", "button", { name: "Refreshed: 0 step 9" });
        expect(await session.applicationPid()).toBe(pid);

        const screenshot = join(project.root, "storybook.png");
        const result = await session.call("gtkx_take_screenshot", { path: screenshot });
        expect(result.content.some((item) => item.type === "image")).toBe(true);
        expect(existsSync(screenshot)).toBe(true);
        await session.stop();
        expect(session.child.exitCode).toBe(0);
        expect(() => process.kill(pid, 0)).toThrow();
    });

    it.each(["Missing", "Missing value"])("recovers a component after %s is created", async (missingModule) => {
        using project = createCliProject({
            prefix: "gtkx-storybook-component-import-",
            config: CONFIG,
            files: { ...projectFiles(), [STORY]: story(1).replace("args: { step: 1 }", "args: {}") },
            hasStore: true,
            shouldShareStore: true,
        });
        await using session = await startStorybookSession(project);
        const pid = await session.applicationPid();
        await session.click("role", "button", { name: "Counter: 0 step 1" });
        await session.waitForWidget("role", "button", { name: "Counter: 1 step 1" });
        const specifier = `./${missingModule}`;
        writeFileSync(join(project.root, COMPONENT),
            `import { initialStep } from ${JSON.stringify(specifier)};\n` +
            counter("Recovered").replace("step = 1", "step = initialStep"));
        await new Promise((resolve) => setTimeout(resolve, 1000));
        writeFileSync(join(project.root, `src/${missingModule}.ts`), "export const initialStep = 2;");

        await expect.poll(
            () => session.query("role", "button", { name: "Recovered: 1 step 2" }),
            { timeout: 15_000 },
        ).toHaveLength(1);
        await session.click("role", "button", { name: "Recovered: 1 step 2" });
        await session.waitForWidget("role", "button", { name: "Recovered: 3 step 2" });
        expect(await session.applicationPid()).toBe(pid);
    });

    it("keeps navigation usable through story syntax, import, preview and configuration failures", async () => {
        using project = createCliProject({
            prefix: "gtkx-storybook-recovery-",
            config: CONFIG,
            files: projectFiles(),
            hasStore: true,
            shouldShareStore: true,
        });
        await using session = await startStorybookSession(project);
        const pid = await session.applicationPid();
        await session.waitForWidget("name", "storybook-story-counter--default");

        writeFileSync(join(project.root, STORY), "export default {");
        await session.waitForWidget("name", "storybook-load-errors");
        await session.click("name", "storybook-story-other--example");
        await session.waitForWidget("role", "button", { name: "Another preview" });
        writeFileSync(join(project.root, STORY), story(2));
        await session.waitForAbsent("name", "storybook-load-errors");

        writeFileSync(join(project.root, STORY), story(4).replace('"./Counter"', '"./Missing"'));
        await session.waitForWidget("name", "storybook-load-errors");
        writeFileSync(join(project.root, "src/Missing.tsx"), counter("Recovered"));
        await session.waitForAbsent("name", "storybook-load-errors");
        await session.click("name", "storybook-story-counter--default");
        await session.waitForWidget("role", "button", { name: "Recovered: 0 step 4" });

        writeFileSync(join(project.root, PREVIEW), "export default {");
        await session.waitForWidget("name", "storybook-load-errors");
        await session.waitForWidget("name", "storybook-story-other--example");
        writeFileSync(join(project.root, PREVIEW), preview("Recovered preview"));
        await session.waitForAbsent("name", "storybook-load-errors");
        await session.waitForWidget("text", "Recovered preview");

        writeFileSync(join(project.root, ".storybook/main.ts"), "export default { stories: 123 };");
        await session.waitForWidget("name", "storybook-load-errors");
        writeFileSync(join(project.root, ".storybook/main.ts"), MAIN);
        await session.waitForAbsent("name", "storybook-load-errors");

        writeFileSync(join(project.root, "src/Missing.tsx"), "export const Counter = (");
        await new Promise((resolve) => setTimeout(resolve, 500));
        await session.waitForWidget("name", "storybook-story-other--example");
        writeFileSync(join(project.root, "src/Missing.tsx"), counter("Component repaired"));
        await session.waitForWidget("role", "button", { name: "Component repaired: 0 step 4" });
        expect(await session.applicationPid()).toBe(pid);
    });

    it.each(["setup/preview.tsx", "setup/../setup/preview.tsx"])(
        "resolves selected configurations with a project-relative preview at %s",
        async (previewPath) => {
            using project = createCliProject({
                prefix: "gtkx-storybook-config-selection-",
                files: {
                    "alternate.gtkx.ts": CONFIG,
                    "story.config.ts": 'export default { stories: ["stories/*.stories.tsx"], ' +
                        `preview: ${JSON.stringify(previewPath)} };`,
                    "setup/preview.tsx": preview("Custom preview"),
                    "stories/Custom.stories.tsx": otherStory().replace('title: "Other", ', ""),
                    ".storybook/main.ts": "invalid source",
                },
                hasStore: true,
                shouldShareStore: true,
            });
            await using session = await startStorybookSession(project, [
                "--config", "alternate.gtkx.ts", "--storybook-config", "story.config.ts",
            ]);
            await session.waitForWidget("name", "storybook-story-stories-custom--example");
            await session.waitForWidget("text", "Custom preview");
            await session.waitForWidget("role", "button", { name: "Another preview" });
            expect(session.child.exitCode).toBeNull();
        },
    );

    it.each(["absolute", "outside"])("rejects %s preview paths", (kind) => {
        using project = createCliProject({
            prefix: "gtkx-storybook-invalid-preview-",
            config: CONFIG,
            files: { ...projectFiles(), [PREVIEW]: preview("Shared preview") },
            hasStore: true,
            shouldShareStore: true,
        });
        const previewPath = kind === "absolute" ? join(project.root, PREVIEW) : "../preview.tsx";
        writeFileSync(join(project.root, ".storybook/main.ts"),
            `export default { preview: ${JSON.stringify(previewPath)} };`);

        expect(runCli(project, ["storybook"]).status).not.toBe(0);
    });

    it("shows empty discovery and recovers when the first story is created", async () => {
        using project = createCliProject({
            prefix: "gtkx-storybook-empty-",
            config: CONFIG,
            files: { "src/keep.ts": "export {};" },
            hasStore: true,
            shouldShareStore: true,
        });
        await using session = await startStorybookSession(project);
        await session.waitForWidget("name", "storybook-empty");
        writeFileSync(join(project.root, SECOND_STORY), otherStory());
        await session.waitForWidget("name", "storybook-story-other--example");
        await session.waitForAbsent("name", "storybook-empty");
        expect(session.child.exitCode).toBeNull();
    });

    it("reports duplicate story IDs and module import failures while rendering valid modules", async () => {
        using project = createCliProject({
            prefix: "gtkx-storybook-invalid-module-",
            config: CONFIG,
            files: {
                ...projectFiles(),
                "src/Duplicate.stories.tsx": otherStory(),
                "src/Invalid.stories.tsx": 'import "./Absent"; export default {}; export const Broken = {};',
            },
            hasStore: true,
            shouldShareStore: true,
        });
        await using session = await startStorybookSession(project);
        await session.waitForWidget("name", "storybook-load-errors");
        await session.waitForWidget("name", "storybook-story-counter--default");
        await session.waitForWidget("role", "button", { name: "Counter: 0 step 1" });
        expect(session.child.exitCode).toBeNull();
    });

    it("rejects invalid configurations, missing selected configurations, and headless-only size", () => {
        using project = createCliProject({
            prefix: "gtkx-storybook-invalid-config-",
            config: CONFIG,
            files: { ".storybook/main.ts": 'export default { stories: "src/**/*.stories.tsx" };' },
            hasStore: true,
            shouldShareStore: true,
        });
        expect(runCli(project, ["storybook"]).status).not.toBe(0);
        expect(runCli(project, ["storybook", "--storybook-config", "absent.ts"]).status).not.toBe(0);
        expect(runCli(project, ["storybook", "--size", "800x600"]).status).not.toBe(0);
    });

    it("rejects an explorer project without the storybook package", () => {
        using project = createCliProject({
            prefix: "gtkx-storybook-missing-package-",
            config: CONFIG,
            omitPackages: ["storybook"],
            hasStore: true,
            shouldShareStore: true,
        });
        expect(runCli(project, ["storybook"]).status).not.toBe(0);
    });
});
