import { execFileSync } from "node:child_process";
import { accessSync, cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { prepareReferenceSearch } from "./reference-search-exclude.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const website = join(here, "..");
const root = join(website, "..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const commitType = "commit";
const manifest = JSON.parse(readFileSync(join(website, "versions.json"), "utf8"));

const referenceDirectory = (version) => join(website, version.prefix.replace(/^\//, ""), "reference");

const versionsWithSource = (source) => manifest.versions.filter((version) => version.reference.source === source);

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

const markdownFiles = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) {
            return markdownFiles(path);
        }

        return entry.name.endsWith(".md") ? [path] : [];
    });

const rewriteReferenceLinks = (directory, prefix) => {
    if (prefix === "") {
        return;
    }

    const pattern = /\]\((\/reference\/)/g;

    for (const file of markdownFiles(directory)) {
        const source = readFileSync(file, "utf8");
        const updated = source.replaceAll(pattern, (_match, section) => `](${prefix}${section}`);

        if (updated !== source) {
            writeFileSync(file, updated);
        }
    }
};

const verifyTag = ({ tag, commit }) => {
    if (!hasRevision(tag)) {
        return;
    }

    const actual = read("git", ["rev-parse", commitRevision(tag)], root);

    if (actual !== commit) {
        throw new Error(`${tag} resolves to ${actual}, expected ${commit}.`);
    }
};

const fetchTagCommit = ({ tag, commit }) => {
    run("git", ["fetch", "--no-tags", "--depth=1", "origin", `refs/tags/${tag}`], root);
    const actual = read("git", ["rev-parse", "FETCH_HEAD^{commit}"], root);

    if (actual !== commit) {
        throw new Error(`Fetched ${tag} resolves to ${actual}, expected ${commit}.`);
    }
};

const ensureTagCommit = (reference) => {
    verifyTag(reference);

    if (!hasRevision(reference.commit)) {
        fetchTagCommit(reference);
    }
};

const generateTagged = (version) => {
    const { commit } = version.reference;
    ensureTagCommit(version.reference);

    const origin = read("git", ["remote", "get-url", "origin"], root);
    const store = read(pnpm, ["store", "path"], root);
    const temporary = mkdtempSync(join(tmpdir(), "gtkx-reference-"));
    const archive = join(temporary, "source.tar");
    const source = join(temporary, "source");
    const output = referenceDirectory(version);

    try {
        mkdirSync(source);
        run("git", ["archive", "--format=tar", `--output=${archive}`, commit], root);
        run("tar", ["-xf", archive, "-C", source], root);

        const environment = Object.fromEntries(
            Object.entries(process.env).filter(([key]) => !key.startsWith("NX_TASK_") && key !== "NX_WORKSPACE_ROOT"),
        );
        environment.NX_DAEMON = "false";
        run("git", ["init", "--quiet", "--initial-branch=main"], source, environment);
        run("git", ["fetch", "--quiet", "--no-tags", "--depth=1", root, commit], source, environment);
        run("git", ["update-ref", "refs/heads/main", "FETCH_HEAD"], source, environment);
        run("git", ["remote", "add", "origin", origin], source, environment);
        run(pnpm, ["install", "--frozen-lockfile", "--store-dir", store], source, environment);
        run(pnpm, ["exec", "nx", "run", "@gtkx/website:reference"], source, environment);

        const generated = join(source, "website", "reference");
        requireSidebar(generated);
        rmSync(output, { force: true, recursive: true });
        mkdirSync(dirname(output), { recursive: true });
        cpSync(generated, output, { recursive: true });
        rewriteReferenceLinks(output, version.prefix);
        prepareReferenceSearch(output);
        requireSidebar(output);
    } finally {
        rmSync(temporary, { force: true, recursive: true });
    }
};

const generateFromWorktree = (version) => {
    run(pnpm, ["exec", "typedoc"], website);
    const output = referenceDirectory(version);
    prepareReferenceSearch(output, true);
    requireSidebar(output);
};

const mode = process.argv[2] ?? "all";

if (mode !== "stable" && mode !== "current" && mode !== "all" && mode !== "pins") {
    throw new Error(`Unknown reference generation mode: ${mode}`);
}

if (mode === "pins") {
    const pins = versionsWithSource("tag").map(
        (version) => `${version.prefix}|${version.reference.tag}|${version.reference.commit}`,
    );

    console.log(pins.join("\n"));
} else {
    if (mode === "stable" || mode === "all") {
        for (const version of versionsWithSource("tag")) {
            generateTagged(version);
        }
    }

    if (mode === "current" || mode === "all") {
        for (const version of versionsWithSource("worktree")) {
            generateFromWorktree(version);
        }
    }
}
