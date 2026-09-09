import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppProject, buildAppProject, createAppProject, removeAppProject } from "./app-project.js";

const BUILD_TIMEOUT = 300_000;
const APPLICATION_ID = "com.gtkx.clireactcompiler";
const COMPONENT_PATH = join("src", "counter.tsx");
const LABEL_PATH = join("src", "label.ts");
const CACHE_DIR = "cache";
const OUT_DIR = "dist";
const READ_ONLY_CACHE = "read-only-cache";
const READ_ONLY_MODE = 0o500;
const COMPILER_RUNTIME = "react-compiler-runtime";
const FIRST_LABEL = "first-build";
const SECOND_LABEL = "second-build";
const PLAIN_LABEL = "plain-typescript";
const MEMO_CACHE_SLOT = "$[0]";

const APP_ENTRY = String.raw`import { render } from "./counter.tsx";

process.stdout.write(render() + "\n");
`;

const LABEL_SOURCE = `type Label = { text: string };

const label: Label = { text: ${JSON.stringify(PLAIN_LABEL)} };

export { type Label, label };
`;

const component = (text: string): string =>
    `import { useState } from "react";
import { label } from "./label.js";

const Counter = () => {
    const [count] = useState(0);
    const rows = [label.text, ${JSON.stringify(text)}, String(count)];

    return rows.join("-");
};

const render = (): string => Counter();

export { render };
`;

const createProject = (prefix: string, text: string): AppProject =>
    createAppProject({
        applicationId: APPLICATION_ID,
        entry: APP_ENTRY,
        files: { [COMPONENT_PATH]: component(text), [LABEL_PATH]: LABEL_SOURCE },
        prefix,
    });

const buildProject = async (project: AppProject, cacheDir: string): Promise<string> => {
    const reported = await buildAppProject({ project, outDir: OUT_DIR, cacheDir, minify: false });

    return readFileSync(join(project.root, reported), "utf8");
};

describe("gtkx build (React Compiler)", () => {
    let project: AppProject;
    let first: string;
    let second: string;

    beforeAll(async () => {
        project = createProject("gtkx-react-compiler-", FIRST_LABEL);
        const cacheDir = join(project.root, CACHE_DIR);
        first = await buildProject(project, cacheDir);
        writeFileSync(join(project.root, COMPONENT_PATH), component(SECOND_LABEL));
        second = await buildProject(project, cacheDir);
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(project);
    });

    it("memoizes a component the compiler infers", () => {
        expect(first).toContain(COMPILER_RUNTIME);
        expect(first).toContain(MEMO_CACHE_SLOT);
        expect(first).toContain(FIRST_LABEL);
    });

    it("bundles a module the compiler skips", () => {
        expect(first).toContain(PLAIN_LABEL);
    });

    it("recompiles a changed component instead of replaying the cached transform", () => {
        expect(second).toContain(SECOND_LABEL);
        expect(second).not.toContain(FIRST_LABEL);
        expect(second).toContain(MEMO_CACHE_SLOT);
    });
});

describe("gtkx build (React Compiler cache failures)", () => {
    let project: AppProject;

    beforeAll(() => {
        project = createProject("gtkx-react-compiler-readonly-", FIRST_LABEL);
        mkdirSync(join(project.root, READ_ONLY_CACHE));
        chmodSync(join(project.root, READ_ONLY_CACHE), READ_ONLY_MODE);
    });

    afterAll(() => {
        removeAppProject(project);
    });

    it("builds with a cache directory it cannot write", async () => {
        const bundle = await buildProject(project, join(project.root, READ_ONLY_CACHE));

        expect(bundle).toContain(COMPILER_RUNTIME);
        expect(bundle).toContain(MEMO_CACHE_SLOT);
    }, BUILD_TIMEOUT);
});
