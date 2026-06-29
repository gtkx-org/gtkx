import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { arch, platform } from "node:os";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";

const EMITTED_BINDING_SPECIFIER = "./gtkx.node";

function resolveBinaryPath(projectRequire: ReturnType<typeof createRequire>, currentArch: string): string {
    const nativeRoot = dirname(projectRequire.resolve("@gtkx/native/package.json"));
    const localBinary = join(nativeRoot, `native.linux-${currentArch}-gnu.node`);
    return existsSync(localBinary) ? localBinary : projectRequire.resolve(`@gtkx/native-linux-${currentArch}-gnu`);
}

function resolvePlatformBinary(projectRequire: ReturnType<typeof createRequire>): Buffer {
    const currentPlatform = platform();
    const currentArch = arch();

    if (currentPlatform !== "linux") {
        throw new Error(`Unsupported build platform: ${currentPlatform}, only Linux is supported`);
    }

    if (currentArch !== "x64" && currentArch !== "arm64") {
        throw new Error(`Unsupported build architecture: ${currentArch}, only x64 and arm64 are supported`);
    }

    return readFileSync(resolveBinaryPath(projectRequire, currentArch));
}

function rewriteLoader(code: string): string {
    const idents: string[] = [];
    for (const match of code.matchAll(/export\s*\{\s*([A-Za-z0-9_$]+)\s*\}/g)) {
        const ident = match[1];
        if (ident) {
            idents.push(ident);
        }
    }
    const bindings = idents.join(", ");

    return [
        `import __gtkxNative from "${EMITTED_BINDING_SPECIFIER}";`,
        `const { ${bindings} } = __gtkxNative;`,
        `export { ${bindings} };`,
    ].join("\n");
}

export function gtkxNative(root: string): Plugin {
    const projectRequire = createRequire(join(root, "package.json"));
    let cachedLoaderPath: string | undefined;

    const loaderPath = (): string => {
        cachedLoaderPath ??= join(dirname(projectRequire.resolve("@gtkx/native/package.json")), "index.js");
        return cachedLoaderPath;
    };

    return {
        name: "gtkx:native",
        enforce: "pre",

        buildStart() {
            this.emitFile({ type: "asset", fileName: "gtkx.node", source: resolvePlatformBinary(projectRequire) });
        },

        resolveId(id) {
            return id === EMITTED_BINDING_SPECIFIER ? { id, external: true } : null;
        },

        transform(code, id) {
            return id.replace(/\?.*$/, "") === loaderPath() ? rewriteLoader(code) : null;
        },
    };
}
