import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const frontmatter = /^---\n[\s\S]*?\n---\n+/;
const domAnimationExample = /```jsx\n(?:(?!```)[\s\S])*?animated\.[A-Za-z](?:(?!```)[\s\S])*?```\n*/gu;

const walkEntry = (dir, entry) => {
    if (entry.isDirectory()) {
        return walk(join(dir, entry.name));
    }

    return entry.name.endsWith(".md") ? [join(dir, entry.name)] : [];
};

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => walkEntry(dir, entry));

const prepareReferenceSearch = (referenceDir, shouldRemoveDomAnimationExamples = false) => {
    const overviewFile = join(referenceDir, "index.md");

    for (const file of walk(referenceDir)) {
        const source = readFileSync(file, "utf8").replace(frontmatter, "");
        const body = shouldRemoveDomAnimationExamples ? source.replaceAll(domAnimationExample, "") : source;
        const fields =
            file === overviewFile
                ? ["editLink: false", "lastUpdated: false"]
                : ["search: false", "editLink: false", "lastUpdated: false"];
        writeFileSync(file, `---\n${fields.join("\n")}\n---\n\n${body}`);
    }
};

export { prepareReferenceSearch };
