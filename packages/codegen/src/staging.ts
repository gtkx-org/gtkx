import { mkdirSync, mkdtempSync } from "node:fs";
import { dirname } from "node:path";

const createStagingDir = (target: string): string => {
    mkdirSync(dirname(target), { recursive: true });

    return mkdtempSync(`${target}.tmp-`);
};

export { createStagingDir };
