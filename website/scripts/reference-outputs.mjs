import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const website = join(here, "..");
const projectPath = join(website, "project.json");
const PROJECT_ROOT = "{projectRoot}";

const TARGET_SOURCES = [
    ["reference-current", "worktree"],
    ["reference-stable", "tag"],
];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const byText = (left, right) => left.localeCompare(right);

const referenceOutput = (prefix) => [PROJECT_ROOT, prefix.replace(/^\//, ""), "reference"].filter(Boolean).join("/");

const versionsWithSource = (versions, source) => versions.filter((version) => version.reference.source === source);

const neededOutputs = (versions, source) =>
    versionsWithSource(versions, source)
        .map((version) => referenceOutput(version.prefix))
        .toSorted(byText);

const syncReferenceOutputs = (versions) => {
    const project = readJson(projectPath);

    for (const [name, source] of TARGET_SOURCES) {
        project.targets[name].outputs = neededOutputs(versions, source);
    }

    writeFileSync(projectPath, `${JSON.stringify(project, undefined, 4)}\n`);
};

const assertDeclaredOutputs = (versions) => {
    const targets = readJson(projectPath).targets;

    for (const [name, source] of TARGET_SOURCES) {
        const declared = (targets[name].outputs ?? []).toSorted(byText).join(", ");
        const needed = neededOutputs(versions, source).join(", ");

        if (declared !== needed) {
            throw new Error(
                `website/project.json declares ${name} outputs [${declared}], but versions.json needs [${needed}]. ` +
                    "Run pnpm --filter @gtkx/website reference-sync.",
            );
        }
    }
};

export { assertDeclaredOutputs, syncReferenceOutputs };
