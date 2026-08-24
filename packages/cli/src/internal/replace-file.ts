import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const replaceGeneratedFile = (path: string, contents: string): void => {
    const directory = dirname(path);
    const temporary = join(directory, `.${randomUUID()}.tmp`);
    mkdirSync(directory, { recursive: true });

    try {
        writeFileSync(temporary, contents, { flag: "wx" });
        renameSync(temporary, path);
    } finally {
        rmSync(temporary, { force: true });
    }
};

export { replaceGeneratedFile };
