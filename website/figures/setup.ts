import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

const home = mkdtempSync(join(tmpdir(), "gtkx-figures-"));

for (const [name, directory] of [
    ["XDG_DATA_HOME", "data"],
    ["XDG_CONFIG_HOME", "config"],
    ["XDG_CACHE_HOME", "cache"],
] as const) {
    const path = join(home, directory);
    mkdirSync(path);
    process.env[name] = path;
}

afterAll(() => {
    rmSync(home, { recursive: true, force: true });
});
