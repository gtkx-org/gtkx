import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const here = dirname(fileURLToPath(import.meta.url));
const website = join(here, "..");
const manifestPath = join(website, "versions.json");
const packagePath = join(website, "package.json");
const staging = join(website, ".promote-version");
const SECTIONS = ["guide", "tutorial", "reference"];
const PROJECT_ROOT = "{projectRoot}";
const LINK_PATTERN = /\]\((\/[^)\s]*)\)/g;

const readManifest = () => JSON.parse(readFileSync(manifestPath, "utf8"));

const versionDirectory = (prefix) => join(website, prefix.replace(/^\//, ""));

const requireSingle = (versions, status) => {
    const matches = versions.filter((version) => version.status === status);

    if (matches.length !== 1) {
        throw new Error(`versions.json must declare exactly one ${status} version, found ${matches.length}.`);
    }

    return matches[0];
};

const isSectionPath = (rest) =>
    SECTIONS.some(
        (section) =>
            rest === `/${section}` || rest.startsWith(`/${section}/`) || rest.startsWith(`/${section}#`),
    );

const createRewriter = (moves) => {
    const ordered = moves.toSorted((left, right) => right.from.length - left.from.length);

    return (target) => {
        for (const move of ordered) {
            const owned = move.from === "" || target === move.from || target.startsWith(`${move.from}/`);
            const rest = target.slice(move.from.length);

            if (owned && isSectionPath(rest)) {
                return `${move.to}${rest}`;
            }
        }

        return target;
    };
};

const SKIPPED_DIRECTORIES = new Set(["node_modules", "reference"]);

const markdownFiles = (directory) => {
    if (!existsSync(directory)) {
        return [];
    }

    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) {
            return entry.name.startsWith(".") || SKIPPED_DIRECTORIES.has(entry.name) ? [] : markdownFiles(path);
        }

        return entry.name.endsWith(".md") ? [path] : [];
    });
};

const rewriteLinks = (rewrite) => {
    let changed = 0;

    for (const file of markdownFiles(website)) {
        const source = readFileSync(file, "utf8");
        const updated = source.replaceAll(LINK_PATTERN, (match, target) => {
            const rewritten = rewrite(target);

            return rewritten === target ? match : `](${rewritten})`;
        });

        if (updated !== source) {
            writeFileSync(file, updated);
            changed += 1;
        }
    }

    return changed;
};

const stageSections = (version) => {
    const from = versionDirectory(version.prefix);
    const to = join(staging, version.id);
    mkdirSync(to, { recursive: true });

    for (const section of SECTIONS) {
        const source = join(from, section);

        if (existsSync(source) && statSync(source).isDirectory()) {
            renameSync(source, join(to, section));
        }
    }
};

const unstageSections = (version, prefix) => {
    const from = join(staging, version.id);
    const to = versionDirectory(prefix);
    mkdirSync(to, { recursive: true });

    for (const section of SECTIONS) {
        const source = join(from, section);

        if (existsSync(source)) {
            renameSync(source, join(to, section));
        }
    }
};

const referenceOutput = (prefix) => [PROJECT_ROOT, prefix.replace(/^\//, ""), "reference"].filter(Boolean).join("/");

const syncReferenceOutputs = (versions) => {
    const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
    const targets = manifest.nx.targets;
    const tagged = versions.filter((version) => version.reference.source === "tag");
    const worktree = versions.filter((version) => version.reference.source === "worktree");

    targets["reference-current"].outputs = worktree.map((version) => referenceOutput(version.prefix));
    targets["reference-stable"].outputs = tagged.map((version) => referenceOutput(version.prefix));

    writeFileSync(packagePath, `${JSON.stringify(manifest, undefined, 4)}\n`);
};

const pruneEmptyDirectory = (prefix) => {
    const directory = versionDirectory(prefix);

    if (prefix !== "" && existsSync(directory) && readdirSync(directory).length === 0) {
        rmSync(directory, { recursive: true });
    }
};

const { values } = parseArgs({
    options: {
        to: { type: "string" },
        label: { type: "string" },
        "examples-ref": { type: "string" },
    },
});

if (values.to === undefined || !/^\/[A-Za-z0-9][A-Za-z0-9.-]*$/.test(values.to)) {
    throw new Error("Pass --to with the prefix the outgoing release moves to, for example --to /v1.");
}

if (values["examples-ref"] === undefined) {
    throw new Error("Pass --examples-ref with the git ref the promoted release's examples live on.");
}

const manifest = readManifest();
const outgoing = requireSingle(manifest.versions, "current");

if (outgoing.prefix !== "") {
    throw new Error(`The current version must be served without a prefix, found "${outgoing.prefix}".`);
}

const incoming = requireSingle(manifest.versions, "prerelease");
const retired = manifest.versions.filter((version) => version.status === "old");

if (retired.length > 0) {
    const prefixes = retired.map((version) => version.prefix).join(", ");

    throw new Error(`Retire the old version served at ${prefixes} before promoting another release.`);
}

if (manifest.versions.some((version) => version.prefix === values.to)) {
    throw new Error(`versions.json already declares the prefix ${values.to}.`);
}

if (SECTIONS.includes(values.to.slice(1))) {
    throw new Error(`${values.to} collides with a documentation section; choose another prefix.`);
}

if (existsSync(versionDirectory(values.to))) {
    throw new Error(`${versionDirectory(values.to)} already exists; move it aside first.`);
}

if (existsSync(staging)) {
    throw new Error(`${staging} is left over from an interrupted run; reset the working tree before retrying.`);
}

const moves = [
    { from: outgoing.prefix, to: values.to },
    { from: incoming.prefix, to: "" },
];

stageSections(outgoing);
stageSections(incoming);
unstageSections(outgoing, values.to);
unstageSections(incoming, "");
pruneEmptyDirectory(incoming.prefix);

const changed = rewriteLinks(createRewriter(moves));

outgoing.prefix = values.to;
outgoing.status = "old";
incoming.prefix = "";
incoming.status = "current";
incoming.label = values.label ?? incoming.id;

incoming.examplesRef = values["examples-ref"];

const others = manifest.versions.filter((version) => version !== incoming && version !== outgoing);

manifest.versions = [incoming, outgoing, ...others];

writeFileSync(manifestPath, `${JSON.stringify(manifest, undefined, 4)}\n`);
syncReferenceOutputs(manifest.versions);
rmSync(staging, { force: true, recursive: true });

console.log(`Promoted GTKX ${incoming.id} to the site root and moved ${outgoing.id} to ${values.to}.`);
console.log(`Rewrote documentation links in ${changed} files.`);
console.log("Regenerate the API references, then rebuild the site.");
