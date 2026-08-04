import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";

const hasGlibTool = (name: string): boolean => {
    try {
        execFileSync(resolveExecutable(name), ["--version"], {
            stdio: ["ignore", "ignore", "ignore"],
        });

        return true;
    } catch {
        return false;
    }
};

const hasGlibCompileSchemas = (): boolean => hasGlibTool("glib-compile-schemas");
const hasGlibCompileResources = (): boolean => hasGlibTool("glib-compile-resources");

export { hasGlibCompileResources, hasGlibCompileSchemas };
