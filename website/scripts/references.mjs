import { execFileSync } from "node:child_process";
import { accessSync, cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { prepareReferenceSearch } from "./reference-search-exclude.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const website = join(here, "..");
const root = join(website, "..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const stableTag = "v1.6.0";
const stableCommit = "76c6292fdecb0b18060d7c54bb7e001a4a139440";
const commitType = "commit";

const execute = (command, args, options) => {
    try {
        return execFileSync(command, args, options);
    } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            throw new Error(`Required executable "${command}" was not found.`, { cause: error });
        }

        throw error;
    }
};

const run = (command, args, cwd, environment = process.env) => {
    execute(command, args, { cwd, env: environment, stdio: "inherit" });
};

const read = (command, args, cwd) =>
    execute(command, args, { cwd, encoding: "utf8" }).trim();

const commitRevision = (revision) => `${revision}^{${commitType}}`;

const hasRevision = (revision) => {
    try {
        execute("git", ["cat-file", "-e", commitRevision(revision)], {
            cwd: root,
            stdio: "ignore",
        });

        return true;
    } catch {
        return false;
    }
};

const requireSidebar = (dir) => {
    accessSync(join(dir, "typedoc-sidebar.json"));
};

const verifyStableTag = () => {
    if (!hasRevision(stableTag)) {
        return;
    }

    const actual = read("git", ["rev-parse", commitRevision(stableTag)], root);

    if (actual !== stableCommit) {
        throw new Error(`${stableTag} resolves to ${actual}, expected ${stableCommit}.`);
    }
};

const fetchStableCommit = () => {
    run("git", ["fetch", "--no-tags", "--depth=1", "origin", `refs/tags/${stableTag}`], root);
    const actual = read("git", ["rev-parse", "FETCH_HEAD^{commit}"], root);

    if (actual !== stableCommit) {
        throw new Error(`Fetched ${stableTag} resolves to ${actual}, expected ${stableCommit}.`);
    }
};

const ensureStableCommit = () => {
    verifyStableTag();

    if (!hasRevision(stableCommit)) {
        fetchStableCommit();
    }
};

const generateStable = () => {
    ensureStableCommit();

    const origin = read("git", ["remote", "get-url", "origin"], root);
    const store = read(pnpm, ["store", "path"], root);
    const temporary = mkdtempSync(join(tmpdir(), "gtkx-reference-"));
    const archive = join(temporary, "source.tar");
    const source = join(temporary, "source");
    const output = join(website, "reference");

    try {
        mkdirSync(source);
        run("git", ["archive", "--format=tar", `--output=${archive}`, stableCommit], root);
        run("tar", ["-xf", archive, "-C", source], root);

        const environment = Object.fromEntries(
            Object.entries(process.env).filter(([key]) => !key.startsWith("NX_TASK_") && key !== "NX_WORKSPACE_ROOT"),
        );
        environment.NX_DAEMON = "false";
        run("git", ["init", "--quiet", "--initial-branch=main"], source, environment);
        run("git", ["fetch", "--quiet", "--no-tags", "--depth=1", root, stableCommit], source, environment);
        run("git", ["update-ref", "refs/heads/main", "FETCH_HEAD"], source, environment);
        run("git", ["remote", "add", "origin", origin], source, environment);
        run(pnpm, ["install", "--frozen-lockfile", "--store-dir", store], source, environment);
        run(pnpm, ["exec", "nx", "run", "@gtkx/website:reference"], source, environment);

        const generated = join(source, "website", "reference");
        requireSidebar(generated);
        rmSync(output, { force: true, recursive: true });
        cpSync(generated, output, { recursive: true });
        prepareReferenceSearch(output);
        requireSidebar(output);
    } finally {
        rmSync(temporary, { force: true, recursive: true });
    }
};

const generateCurrent = () => {
    run(pnpm, ["exec", "typedoc"], website);
    const output = join(website, "v2", "reference");
    prepareReferenceSearch(output, true);
    requireSidebar(output);
};

const mode = process.argv[2] ?? "all";

if (mode === "stable" || mode === "all") {
    generateStable();
}

if (mode === "current" || mode === "all") {
    generateCurrent();
}

if (mode !== "stable" && mode !== "current" && mode !== "all") {
    throw new Error(`Unknown reference generation mode: ${mode}`);
}
