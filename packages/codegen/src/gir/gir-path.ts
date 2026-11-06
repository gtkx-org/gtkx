import { formatChildProcessError, resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const SYSTEM_GIR_PATH = "/usr/share/gir-1.0";

/**
 * The directories to search for `.gir` files, in precedence order: the config's own `girPath`, then
 * `GTKX_GIR_PATH`, then `/usr/share/gir-1.0`, then the girdir pkg-config reports for
 * gobject-introspection-1.0, then the `gir-1.0` directory under its libdir, where Debian and Ubuntu install
 * architecture-dependent GIR files. Duplicates are dropped, and the system directories are included only when
 * they exist.
 *
 * @throws If pkg-config is installed but fails while being queried.
 */
const resolveGirPath = (configGirPath: string[] | undefined, root: string = process.cwd()): string[] => {
    const paths: string[] = [];

    if (configGirPath) {
        paths.push(...configGirPath.map((path) => resolve(root, path)));
    }

    const envPath = process.env.GTKX_GIR_PATH;

    if (envPath) {
        paths.push(...envPath.split(":").filter((path) => path.length > 0));
    }

    const systemPaths = [SYSTEM_GIR_PATH, ...queryPkgConfigGirDirs()];
    paths.push(...systemPaths.filter((path) => existsSync(path)));

    return [...new Set(paths)];
};

const pkgConfigError = (variable: string, error: unknown): Error => {
    const details = formatChildProcessError(error);
    const suffix = details ? `:\n${details}` : "";

    return new Error(`pkg-config failed querying gobject-introspection-1.0 ${variable}${suffix}`, { cause: error });
};

const resolvePkgConfig = (): string | undefined => {
    try {
        return resolveExecutable("pkg-config");
    } catch {
        return undefined;
    }
};

const queryPkgConfigVariable = (pkgConfig: string, variable: string): string | undefined => {
    try {
        const output = execFileSync(pkgConfig, [`--variable=${variable}`, "gobject-introspection-1.0"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });

        const trimmed = output.trim();

        return trimmed.length > 0 ? trimmed : undefined;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return;
        }

        throw pkgConfigError(variable, error);
    }
};

const queryPkgConfigGirDirs = (): string[] => {
    const pkgConfig = resolvePkgConfig();

    if (pkgConfig === undefined) {
        return [];
    }

    const girDir = queryPkgConfigVariable(pkgConfig, "girdir");
    const libDir = queryPkgConfigVariable(pkgConfig, "libdir");

    return [girDir, libDir === undefined ? undefined : join(libDir, "gir-1.0")].filter(
        (path): path is string => path !== undefined,
    );
};

export { resolveGirPath };
