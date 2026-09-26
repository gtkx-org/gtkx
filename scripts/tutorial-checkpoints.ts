import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { ROOT_DIR, runAsync, verifyAppStarts } from "./e2e-registry.js";

type Chapter = { slug: string; title: string; dependencies?: string[] };
type TutorialPackage = {
    engines: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
};

const tutorialDir = join(ROOT_DIR, "examples", "tutorial");
const chapters = JSON.parse(
    readFileSync(join(tutorialDir, "checkpoints", "chapters.json"), "utf8"),
) as Chapter[];

const { values } = parseArgs({
    options: {
        chapter: { type: "string", default: "flatpak" },
        version: { type: "string", default: "v2" },
        from: { type: "string" },
        output: { type: "string" },
        check: { type: "boolean", default: false },
        dependencies: { type: "string" },
    },
});

if (values.version !== "v2" && values.version !== "v1") {
    throw new Error("Choose --version v2 or v1");
}

const docsDir = join(ROOT_DIR, "website", values.version === "v2" ? "v2" : "", "tutorial");
const sourceManifest = values.version === "v2"
    ? readFileSync(join(tutorialDir, "package.json"), "utf8")
    : execFileSync(resolveExecutable("git"), ["show", "v1.6.0:examples/tutorial/package.json"], {
            cwd: ROOT_DIR,
            encoding: "utf8",
        });
const sourcePackage = JSON.parse(sourceManifest) as TutorialPackage;
const gtkxVersion = sourcePackage.dependencies["@gtkx/react"];

if (gtkxVersion === undefined) {
    throw new Error("The tutorial must declare a GTKX version");
}
sourcePackage.dependencies["@gtkx/runtime"] = gtkxVersion;

for (const dependencies of [sourcePackage.dependencies, sourcePackage.devDependencies]) {
    for (const name of Object.keys(dependencies)) {
        if (name.startsWith("@gtkx/")) {
            dependencies[name] = gtkxVersion.replace(/^[~^]/u, "");
        }
    }
}
const fromIndex = values.from === undefined ? 0 : chapters.findIndex((chapter) => chapter.slug === values.from);

if (fromIndex === -1) {
    throw new Error("Unknown starting chapter");
}

const chapterIndex = chapters.findIndex((chapter) => chapter.slug === values.chapter);

if (chapterIndex === -1) {
    throw new Error(`Choose a chapter: ${chapters.map((chapter) => chapter.slug).join(", ")}`);
}

if (fromIndex > chapterIndex) {
    throw new Error("The starting chapter must precede the selected checkpoint");
}

if (values.output === undefined && !values.check) {
    throw new Error("Pass --output with a new project directory, or --check to validate the checkpoints");
}

if (values.dependencies !== undefined && !values.check) {
    throw new Error("--dependencies is only used with --check");
}

const output = values.output === undefined
    ? mkdtempSync(join(tmpdir(), "gtkx-tutorial-checkpoints-"))
    : resolve(values.output);

if (values.output !== undefined) {
    if (existsSync(output)) {
        throw new Error(`Output directory already exists: ${output}`);
    }

    mkdirSync(output, { recursive: true });
}

function writeProjectFile(path: string, contents: string): void {
    const destination = join(output, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, contents);
}

function writeScaffold(): void {
    const source = sourcePackage;
    const manifest = {
        name: "gtkx-tutorial-checkpoint",
        version: "0.0.1",
        private: true,
        type: "module",
        engines: source.engines,
        allowScripts: { "@swc/core": true },
        scripts: {
            dev: "gtkx dev",
            build: "gtkx build",
            codegen: "gtkx codegen",
            typecheck: "gtkx codegen && tsc",
            test: "vitest run",
            start: "node dist/bundle.mjs",
            deploy: "gtkx deploy",
        },
        dependencies: Object.fromEntries(
            Object.entries(source.dependencies).filter(([name]) =>
                ["@gtkx/cairo", "@gtkx/css", "@gtkx/runtime", "@gtkx/react", "react"].includes(name)),
        ),
        devDependencies: source.devDependencies,
    };

    writeProjectFile("package.json", `${JSON.stringify(manifest, null, 4)}\n`);

    for (const file of ["tsconfig.json", "src/gtkx-env.d.ts"]) {
        writeProjectFile(file, readFileSync(join(tutorialDir, file), "utf8"));
    }

    const vitestTemplate = readFileSync(
        join(ROOT_DIR, "packages", "create-gtkx", "src", "templates", "vitest.config.ts.ejs"),
        "utf8",
    );
    writeProjectFile("vitest.config.ts", vitestTemplate.replace('<%= isTypescript ? "ts,tsx" : "js,jsx" %>', "ts,tsx"));
    cpSync(join(tutorialDir, "data", "icons"), join(output, "data", "icons"), { recursive: true });
}

function mergeProjectJson(path: string, contents: string): void {
    const original = JSON.parse(readFileSync(join(output, path), "utf8")) as Record<string, unknown>;
    const addition = JSON.parse(contents) as Record<string, unknown>;

    for (const [key, value] of Object.entries(addition)) {
        const previous = original[key];
        const isMergeObjects = typeof previous === "object" && previous !== null &&
            typeof value === "object" && value !== null;
        original[key] = isMergeObjects ? { ...previous, ...value } : value;
    }
    writeProjectFile(path, `${JSON.stringify(original, null, 4)}\n`);
}

function isProjectPath(path: string | undefined): path is string {
    return path !== undefined && /^[\w.-]+(?:\/[\w.-]+)*$/.test(path) && !path.includes("..");
}

function applyBlock(block: RegExpExecArray): void {
    const language = block[1];
    const path = block[2];
    const mode = block[3];
    const contents = block[4];

    if (contents === undefined || !isProjectPath(path)) {
        throw new Error("Invalid tutorial file fence");
    }

    if (language === "diff") {
        execFileSync(resolveExecutable("git"), ["apply", "--recount", "--unidiff-zero", "-"], {
            cwd: output,
            input: `--- a/${path}\n+++ b/${path}\n${contents}`,
            stdio: ["pipe", "inherit", "inherit"],
        });
    } else if (mode === "append") {
        writeProjectFile(path, `${readFileSync(join(output, path), "utf8").trimEnd()}\n\n${contents}`);
    } else if (mode === "merge") {
        mergeProjectJson(path, contents);
    } else {
        writeProjectFile(path, contents);
    }
}

function applyChapter(chapter: Chapter): void {
    const page = readFileSync(join(docsDir, `${chapter.slug}.md`), "utf8");
    const pattern = /^```(ts|tsx|diff|json|xml|po|text) \[([^\]\n]+)\](?: (append|merge))?\n([\s\S]*?)^```$/gm;
    let count = 0;

    for (const block of page.matchAll(pattern)) {
        applyBlock(block);
        count += 1;
    }

    if (count === 0) {
        throw new Error(`No file fences in ${chapter.slug}`);
    }

    if (chapter.slug === "packaging") {
        cpSync(join(tutorialDir, "LICENSE"), join(output, "LICENSE"));
    }

    console.log(`${chapter.title}: applied ${String(count)} file edits from the tutorial`);
}

async function checkChapter(): Promise<void> {
    const options = { cwd: output, env: process.env };
    await runAsync("npm", ["run", "typecheck"], options);
    await runAsync("npm", ["run", "build"], options);
    await verifyAppStarts(output, {
        command: process.execPath,
        args: ["dist/bundle.mjs"],
        env: { XDG_DATA_HOME: join(output, ".checkpoint-data"), GSETTINGS_BACKEND: "memory" },
    });

    if (existsSync(join(output, "tests", "tasks.test.tsx"))) {
        await runAsync("npm", ["test"], options);
    }
}

try {
    writeScaffold();
    const selectedChapters = chapters.slice(0, chapterIndex + 1);

    for (const [index, chapter] of selectedChapters.entries()) {
        applyChapter(chapter);

        const manifestPath = join(output, "package.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as TutorialPackage;
        const dependencies = chapter.dependencies ?? [];
        for (const name of dependencies) {
            const version = sourcePackage.dependencies[name];
            if (version === undefined) {
                throw new Error(`Missing tutorial dependency ${name}`);
            }
            manifest.dependencies[name] = version;
        }
        writeProjectFile("package.json", `${JSON.stringify(manifest, null, 4)}\n`);

        if (values.check) {
            if (index === 0 || (values.dependencies === undefined && dependencies.length > 0)) {
                if (values.dependencies === undefined) {
                    await runAsync("npm", ["install"], { cwd: output, env: process.env });
                } else {
                    cpSync(resolve(values.dependencies), join(output, "node_modules"), {
                        recursive: true,
                        verbatimSymlinks: true,
                    });
                }
            }

            if (index >= fromIndex) {
                await checkChapter();
            }
        }
    }

    console.log(values.output === undefined ? "Tutorial checkpoints passed" : `Checkpoint project: ${output}`);
} finally {
    if (values.output === undefined) {
        rmSync(output, { recursive: true, force: true });
    }
}
