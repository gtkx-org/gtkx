import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { formatChildProcessError } from "@gtkx/utils";

const SYSTEM_GIR_PATH = "/usr/share/gir-1.0";

export const resolveGirPath = (configGirPath: string[] | undefined): string[] => {
    const paths: string[] = [];

    if (configGirPath) {
        paths.push(...configGirPath);
    }

    const envPath = process.env["GTKX_GIR_PATH"];
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
        const details = formatChildProcessError(error);
        throw new Error(
            `pkg-config failed querying gobject-introspection-1.0 girdir${details ? `:\n${details}` : ""}`,
            {
                cause: error,
            },
        );
    }
};
