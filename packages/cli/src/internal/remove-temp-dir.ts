import { rmSync } from "node:fs";

export const removeTempDir = (dir: string): void => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
};
