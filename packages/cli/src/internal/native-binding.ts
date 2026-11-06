import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const resolveNativeManifest = (root: string): string => {
    const runtimeManifest = createRequire(join(root, "package.json")).resolve("@gtkx/runtime/package.json");

    return createRequire(runtimeManifest).resolve("@gtkx/native/package.json");
};

const resolveBinding = (root: string, arch: "x64" | "arm64"): string | undefined => {
    const nativeManifest = resolveNativeManifest(root);
    const nativeRoot = dirname(nativeManifest);
    const local = join(nativeRoot, `native.linux-${arch}-gnu.node`);

    if (existsSync(local)) {
        return local;
    }

    try {
        return createRequire(nativeManifest).resolve(`@gtkx/native-linux-${arch}-gnu`);
    } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "MODULE_NOT_FOUND") {
            return;
        }

        throw error;
    }
};

export { resolveBinding, resolveNativeManifest };
