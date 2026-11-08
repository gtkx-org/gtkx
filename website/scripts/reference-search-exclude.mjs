import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const frontmatter = /^---\n[\s\S]*?\n---\n+/;
const siblingLink = /\]\(([^/)#]+\.md)(?:#[^)]*)?\)/gu;
const searchableRoots = [join("@gtkx", "config", "index", "type-aliases", "Config.md")];
const unsearchedPackages = [join("@gtkx", "gl")];
const domAnimationExample = /```jsx\n(?:(?!```)[\s\S])*?animated\.[A-Za-z](?:(?!```)[\s\S])*?```\n*/gu;
const pageTitle = /^# .+$/mu;
const nonProse = /^(?:[#>|*`-]|Defined in:)/u;
const markdownLink = /\[([^\]]*)\]\([^)]*\)/gu;
const maxDescriptionLength = 160;

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

const isUnsearched = (referenceDir, file) =>
    unsearchedPackages.some((name) => {
        const packageDir = join(referenceDir, name);

        return file.startsWith(`${packageDir}/`) && file !== join(packageDir, "index.md");
    });

const searchMode = (referenceDir, searchable, file) => {
    if (searchable.has(file)) {
        return [];
    }

    return [isUnsearched(referenceDir, file) ? "search: false" : "search: title"];
};

const shorten = (text) => {
    if (text.length <= maxDescriptionLength) {
        return text;
    }

    const head = text.slice(0, maxDescriptionLength);
    const sentenceEnd = head.lastIndexOf(". ");

    if (sentenceEnd > 0) {
        return head.slice(0, sentenceEnd + 1);
    }

    return `${head.slice(0, head.lastIndexOf(" "))}…`;
};

const describe = (body) => {
    const title = pageTitle.exec(body);

    if (!title) {
        return [];
    }

    const paragraph = body
        .slice(title.index + title[0].length)
        .split(/\n{2,}/u)
        .map((block) => block.trim())
        .find((block) => block !== "" && !nonProse.test(block));

    if (!paragraph) {
        return [];
    }

    const text = paragraph
        .replaceAll(markdownLink, "$1")
        .replaceAll(/\\(.)/gu, "$1")
        .replaceAll(/[`*]/gu, "")
        .replaceAll(/\s+/gu, " ");

    return [`description: ${JSON.stringify(shorten(text))}`];
};

const prepareReferenceSearch = (referenceDir, shouldRemoveDomAnimationExamples = false) => {
    const searchable = searchablePages(referenceDir);

    for (const file of walk(referenceDir)) {
        const source = readFileSync(file, "utf8").replace(frontmatter, "");
        const body = shouldRemoveDomAnimationExamples ? source.replaceAll(domAnimationExample, "") : source;
        const fields = [
            ...searchMode(referenceDir, searchable, file),
            ...describe(body),
            "editLink: false",
            "lastUpdated: false",
        ];
        writeFileSync(file, `---\n${fields.join("\n")}\n---\n\n${body}`);
    }
};

export { prepareReferenceSearch };
