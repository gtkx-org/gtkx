import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

const home = mkdtempSync(join(tmpdir(), "gtkx-figures-"));

for (const [name, directory] of [
    ["HOME", "home"],
    ["XDG_DATA_HOME", "data"],
    ["XDG_CONFIG_HOME", "config"],
    ["XDG_CACHE_HOME", "cache"],
] as const) {
    const path = join(home, directory);
    mkdirSync(path);
    process.env[name] = path;
}

mkdirSync(join(home, "config", "gtk-4.0"));
writeFileSync(join(home, "config", "gtk-4.0", "settings.ini"), "[Settings]\ngtk-decoration-layout=appmenu:close\n");

afterAll(() => {
    rmSync(home, { recursive: true, force: true });
});
