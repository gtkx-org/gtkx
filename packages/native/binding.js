import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const resolveBinding = (projectManifest, arch) => {
    const projectRequire = createRequire(projectManifest);
    const nativeManifest = projectRequire.resolve("@gtkx/native/package.json");
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

export { resolveBinding };
