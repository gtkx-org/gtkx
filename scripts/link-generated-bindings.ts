import { existsSync, lstatSync, mkdirSync, readlinkSync, realpathSync, symlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

for (const name of ["gi", "jsx"]) {
    const path = join(root, "node_modules", "@gtkx", name);
    const store = join(root, "node_modules", ".gtkx", name);
    const target = relative(dirname(path), store);
    const existing = lstatSync(path, { throwIfNoEntry: false });

    if (existing === undefined) {
        mkdirSync(dirname(path), { recursive: true });
        symlinkSync(target, path, "dir");
    } else if (existing.isSymbolicLink() && readlinkSync(path) === target) {
        continue;
    } else if (existsSync(path) && existsSync(store) && realpathSync(path) === realpathSync(store)) {
        continue;
    } else {
        throw new Error(`Cannot link ${path}: an existing path does not resolve to ${store}`);
    }
}
