import { isRecord } from "@gtkx/utils";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const MANIFEST_NAME = "package.json";
const MODULE_PACKAGE_TYPE = "module";
const MODULE_PACKAGE_EXTENSION = ".js";
const NON_MODULE_PACKAGE_EXTENSION = ".mjs";

const nearestManifest = (dir: string): string | null => {
    const candidate = join(dir, MANIFEST_NAME);

    if (existsSync(candidate)) {
        return candidate;
    }

    const parent = dirname(dir);

    return parent === dir ? null : nearestManifest(parent);
};

const parseManifest = (manifestPath: string): unknown => {
    try {
        return JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
        return null;
    }
};

const packageType = (dir: string): string | null => {
    const manifestPath = nearestManifest(resolve(dir));

    if (manifestPath === null) {
        return null;
    }

    const manifest = parseManifest(manifestPath);

    if (!isRecord(manifest)) {
        return null;
    }

    return typeof manifest.type === "string" ? manifest.type : null;
};

const esmExtension = (emitDir: string): string =>
    packageType(emitDir) === MODULE_PACKAGE_TYPE ? MODULE_PACKAGE_EXTENSION : NON_MODULE_PACKAGE_EXTENSION;

export { esmExtension };
