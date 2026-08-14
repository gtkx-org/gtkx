import { formatChildProcessError, resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const SYSTEM_GIR_PATH = "/usr/share/gir-1.0";

/**
 * The directories to search for `.gir` files, in precedence order: the config's own `girPath`, then
 * `GTKX_GIR_PATH`, then `/usr/share/gir-1.0`, then the girdir pkg-config reports for
 * gobject-introspection-1.0. Duplicates are dropped, and the system directories are included only when they exist.
 *
 * @throws If pkg-config is installed but fails while being queried.
 */
const resolveGirPath = (configGirPath: string[] | undefined): string[] => {
    const paths: string[] = [];

    if (configGirPath) {
        paths.push(...configGirPath);
    }

    const envPath = process.env.GTKX_GIR_PATH;

    if (envPath) {
        paths.push(...envPath.split(":").filter((path) => path.length > 0));
    }

    if (existsSync(SYSTEM_GIR_PATH)) {
        paths.push(SYSTEM_GIR_PATH);
    }

    const pkgConfigPath = queryPkgConfigGirDir();

    if (pkgConfigPath !== undefined && existsSync(pkgConfigPath)) {
        paths.push(pkgConfigPath);
    }

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
