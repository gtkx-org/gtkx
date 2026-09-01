import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const referenceDir = join(dirname(fileURLToPath(import.meta.url)), "..", "reference");
const overviewFile = join(referenceDir, "index.md");
const frontmatter = /^---\n[\s\S]*?\n---\n+/;
const domAnimationExample = /```jsx\n(?:(?!```)[\s\S])*?animated\.[A-Za-z](?:(?!```)[\s\S])*?```\n*/gu;

const walkEntry = (dir, entry) => {
    if (entry.isDirectory()) {
        return walk(join(dir, entry.name));
    }

    return entry.name.endsWith(".md") ? [join(dir, entry.name)] : [];
};

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => walkEntry(dir, entry));

for (const file of walk(referenceDir)) {
    const body = readFileSync(file, "utf8").replace(frontmatter, "").replaceAll(domAnimationExample, "");
    const fields = file === overviewFile ? ["editLink: false"] : ["search: false", "editLink: false"];
    writeFileSync(file, `---\n${fields.join("\n")}\n---\n\n${body}`);
}
