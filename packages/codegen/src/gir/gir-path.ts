import { formatChildProcessError, resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const SYSTEM_GIR_PATH = "/usr/share/gir-1.0";

const isNonEmpty = (path: string): boolean => path.length > 0;

const configuredPaths = (paths: string[] | undefined, root: string): string[] =>
    (paths ?? []).map((path) => isAbsolute(path) ? path : resolve(root, path));

const environmentPaths = (): string[] =>
    (process.env.GTKX_GIR_PATH ?? "").split(":").filter((path) => isNonEmpty(path));

const existingPath = (path: string | undefined): string[] =>
    path !== undefined && existsSync(path) ? [path] : [];

/**
 * The directories to search for `.gir` files, in precedence order: the config's own `girPath`, resolved
 * against `configRoot`, then `GTKX_GIR_PATH`, then `/usr/share/gir-1.0`, then the girdir pkg-config reports
 * for gobject-introspection-1.0. Duplicates are dropped, and system directories are included only when they exist.
 *
 * @param configGirPath Search paths declared by the project, absolute or relative to `configRoot`.
 * @param configRoot Directory that owns the configuration; defaults to the current working directory.
 * @throws If pkg-config is installed but fails while being queried.
 */
const resolveGirPath = (configGirPath: string[] | undefined, configRoot: string = process.cwd()): string[] => {
    const pkgConfigPath = queryPkgConfigGirDir();

    const paths = [
        ...configuredPaths(configGirPath, configRoot),
        ...environmentPaths(),
        ...existingPath(SYSTEM_GIR_PATH),
        ...existingPath(pkgConfigPath),
    ];

    return [...new Set(paths)];
};

const pkgConfigGirDirError = (error: unknown): Error => {
    const details = formatChildProcessError(error);
    const suffix = details ? `:\n${details}` : "";

    return new Error(`pkg-config failed querying gobject-introspection-1.0 girdir${suffix}`, { cause: error });
};

const resolvePkgConfig = (): string | undefined => {
    try {
        return resolveExecutable("pkg-config");
    } catch {
        return undefined;
    }
};

const queryPkgConfigGirDir = (): string | undefined => {
    const pkgConfig = resolvePkgConfig();

    if (pkgConfig === undefined) {
        return undefined;
    }

    try {
        const output = execFileSync(pkgConfig, ["--variable=girdir", "gobject-introspection-1.0"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });

        const trimmed = output.trim();

        return trimmed.length > 0 ? trimmed : undefined;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return;
        }

        throw pkgConfigGirDirError(error);
    }
};

export { resolveGirPath };
