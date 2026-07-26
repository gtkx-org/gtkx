import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const referenceDir = join(dirname(fileURLToPath(import.meta.url)), "..", "reference");
const packagesDir = join(referenceDir, "@gtkx");

const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : (entry.name.endsWith(".md") ? [join(dir, entry.name)] : []),
    );

const frontmatter = /^---\n[\s\S]*?\n---\n+/;

for (const file of walk(referenceDir)) {
    const body = readFileSync(file, "utf8").replace(frontmatter, "");
    const fields = file.startsWith(packagesDir + sep) ? ["search: false", "editLink: false"] : ["editLink: false"];
    writeFileSync(file, `---\n${fields.join("\n")}\n---\n\n${body}`);
}
