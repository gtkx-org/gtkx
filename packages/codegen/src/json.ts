import { readFileSync } from "node:fs";

const readJsonFile = (path: string): unknown => {
    try {
        return JSON.parse(readFileSync(path, "utf8")) as unknown;
    } catch {
        return undefined;
    }
};

export { readJsonFile };
