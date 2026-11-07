import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const frontmatter = /^---\n[\s\S]*?\n---\n+/;
const siblingLink = /\]\(([^/)#]+\.md)(?:#[^)]*)?\)/gu;
const searchableRoots = [join("@gtkx", "config", "index", "type-aliases", "Config.md")];
const domAnimationExample = /```jsx\n(?:(?!```)[\s\S])*?animated\.[A-Za-z](?:(?!```)[\s\S])*?```\n*/gu;

const walkEntry = (dir, entry) => {
    if (entry.isDirectory()) {
        return walk(join(dir, entry.name));
    }

    return entry.name.endsWith(".md") ? [join(dir, entry.name)] : [];
};

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => walkEntry(dir, entry));

const siblingLinks = (file) =>
    [...readFileSync(file, "utf8").matchAll(siblingLink)]
        .map((match) => join(dirname(file), match[1]))
        .filter((link) => existsSync(link));

const linkedPages = (pending, found) => {
    if (pending.length === 0) {
        return found;
    }

    const [file, ...rest] = pending;

    if (found.has(file)) {
        return linkedPages(rest, found);
    }

    return linkedPages([...rest, ...siblingLinks(file)], new Set([...found, file]));
};

const searchablePages = (referenceDir) => {
    const roots = searchableRoots.map((root) => join(referenceDir, root)).filter((root) => existsSync(root));

    return linkedPages(roots, new Set([join(referenceDir, "index.md")]));
};

const prepareReferenceSearch = (referenceDir, shouldRemoveDomAnimationExamples = false) => {
    const searchable = searchablePages(referenceDir);

    for (const file of walk(referenceDir)) {
        const source = readFileSync(file, "utf8").replace(frontmatter, "");
        const body = shouldRemoveDomAnimationExamples ? source.replaceAll(domAnimationExample, "") : source;
        const fields = searchable.has(file)
            ? ["editLink: false", "lastUpdated: false"]
            : ["search: false", "editLink: false", "lastUpdated: false"];
        writeFileSync(file, `---\n${fields.join("\n")}\n---\n\n${body}`);
    }
};

export { prepareReferenceSearch };
