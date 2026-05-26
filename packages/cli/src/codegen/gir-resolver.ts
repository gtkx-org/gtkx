import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

/** Default Linux system location for GIR files. */
const SYSTEM_GIR_PATH = "/usr/share/gir-1.0";

/**
 * Resolves the full set of GIR search paths to use for codegen.
 *
 * The resulting list is deduplicated and ordered by precedence. Sources, in
 * order:
 *
 * 1. Paths from `config.girPath` (highest priority — user override)
 * 2. The `GTKX_GIR_PATH` environment variable (colon-separated)
 * 3. `/usr/share/gir-1.0` if it exists
 * 4. `pkg-config --variable=girdir gobject-introspection-1.0` if available
 *
 * @param configGirPath - Optional `girPath` from the user's `gtkx.config.ts`
 * @returns Ordered, deduplicated list of absolute directory paths
 */
export const resolveGirPath = (configGirPath: readonly string[] | undefined): string[] => {
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

const queryPkgConfigGirDir = (): string | undefined => {
    try {
        const output = execFileSync("pkg-config", ["--variable=girdir", "gobject-introspection-1.0"], {
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "pipe"],
        });
        const trimmed = output.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        const stderr = (error as { stderr?: string | Buffer }).stderr?.toString().trim() ?? "";
        throw new Error(`pkg-config failed querying gobject-introspection-1.0 girdir${stderr ? `:\n${stderr}` : ""}`, {
            cause: error,
        });
    }
};
