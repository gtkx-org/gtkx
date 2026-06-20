import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { arch, platform } from "node:os";
import { join } from "node:path";
import type { Plugin } from "vite";

const NATIVE_BINDING_SUFFIX = "native-binding.cjs";
const EMITTED_BINDING_SPECIFIER = "./gtkx.node";

export function gtkxNative(root: string): Plugin {
    const projectRequire = createRequire(join(root, "package.json"));

    return {
        name: "gtkx:native",
        enforce: "pre",

        buildStart() {
            const currentPlatform = platform();
            const currentArch = arch();

            if (currentPlatform !== "linux") {
                throw new Error(`Unsupported build platform: ${currentPlatform}, only Linux is supported`);
            }

            if (currentArch !== "x64" && currentArch !== "arm64") {
                throw new Error(`Unsupported build architecture: ${currentArch}, only x64 and arm64 are supported`);
            }

            const packageName = `@gtkx/native-linux-${currentArch}-gnu`;
            const nodePath = projectRequire.resolve(packageName);
            const source = readFileSync(nodePath);

            this.emitFile({
                type: "asset",
                fileName: "gtkx.node",
                source,
            });
        },

        resolveId(id) {
            if (id === EMITTED_BINDING_SPECIFIER) {
                return { id, external: true };
            }

            return null;
        },

        transform(_code, id) {
            if (!id.endsWith(NATIVE_BINDING_SUFFIX)) {
                return null;
            }

            return `module.exports = require("${EMITTED_BINDING_SPECIFIER}");`;
        },
    };
}
