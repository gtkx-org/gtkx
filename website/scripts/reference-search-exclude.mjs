import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const glDir = join(dirname(fileURLToPath(import.meta.url)), "..", "reference", "@gtkx", "gl");

const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith(".md") ? [join(dir, entry.name)] : [],
    );

for (const file of walk(glDir)) {
    const source = readFileSync(file, "utf8");
    if (source.startsWith("---\n")) continue;
    writeFileSync(file, `---\nsearch: false\n---\n\n${source}`);
}
