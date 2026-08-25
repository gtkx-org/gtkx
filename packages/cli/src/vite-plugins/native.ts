import type { Plugin } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { arch, platform } from "node:os";
import { dirname, join } from "node:path";
import { stripQuery } from "./strip-query.js";

const EMITTED_BINDING_SPECIFIER = "./gtkx.node";
const BINDING_FILENAME = "gtkx.node";

function resolveBinaryPath(projectRequire: ReturnType<typeof createRequire>, currentArch: string): string {
    const nativeRoot = dirname(projectRequire.resolve("@gtkx/native/package.json"));
    const localBinary = join(nativeRoot, `native.linux-${currentArch}-gnu.node`);

    return existsSync(localBinary) ? localBinary : projectRequire.resolve(`@gtkx/native-linux-${currentArch}-gnu`);
}

function resolvePlatformBinary(projectRequire: ReturnType<typeof createRequire>): Buffer {
    const currentPlatform = platform();

    if (currentPlatform !== "linux") {
        throw new Error(`Unsupported build platform: ${currentPlatform}, only Linux is supported`);
    }

    const currentArch = arch();

    if (currentArch !== "x64" && currentArch !== "arm64") {
        throw new Error(`Unsupported build architecture: ${currentArch}, only x64 and arm64 are supported`);
    }

    return readFileSync(resolveBinaryPath(projectRequire, currentArch));
}

function rewriteLoader(code: string, bindingReferenceId: string): string {
    const idents: string[] = [];

    for (const match of code.matchAll(/export\s*\{\s*([A-Za-z0-9_$]+)\s*\}/g)) {
        const ident = match[1];

        if (ident) {
            idents.push(ident);
        }
    }

    const bindings = idents.join(", ");

    return [
        "import { createRequire as __gtkxCreateRequire } from \"node:module\";",
        "import { fileURLToPath as __gtkxFileURLToPath } from \"node:url\";",
        `const __gtkxNativeLocation = import.meta.ROLLUP_FILE_URL_${bindingReferenceId};`,
        "const __gtkxNativePath = __gtkxNativeLocation.startsWith(\"file:\") " +
        "? __gtkxFileURLToPath(__gtkxNativeLocation) : __gtkxNativeLocation;",
        "const __gtkxNative = __gtkxCreateRequire(import.meta.url)(__gtkxNativePath);",
        `const { ${bindings} } = __gtkxNative;`,
        `export { ${bindings} };`,
    ].join("\n");
}

const transformLoader = (
    code: string,
    id: string,
    loaderPath: string,
    bindingReferenceId: string | null,
): string | null => {
    if (stripQuery(id) !== loaderPath) {
        return null;
    }

    if (bindingReferenceId === null) {
        throw new Error("Cannot render the native loader before its binary has been emitted");
    }

    return rewriteLoader(code, bindingReferenceId);
};

function gtkxNative(root: string): Plugin {
    const projectRequire = createRequire(join(root, "package.json"));
    let cachedLoaderPath: string | undefined;
    let bindingReferenceId: string | null = null;

    const loaderPath = (): string => {
        cachedLoaderPath ??= join(dirname(projectRequire.resolve("@gtkx/native/package.json")), "index.js");

        return cachedLoaderPath;
    };

    return {
        name: "gtkx:native",
        enforce: "pre",
        apply: "build",

        buildStart() {
            bindingReferenceId = this.emitFile({
                type: "asset",
                fileName: BINDING_FILENAME,
                source: resolvePlatformBinary(projectRequire),
            });
        },

        resolveId(id) {
            return id === EMITTED_BINDING_SPECIFIER ? { id, external: true } : null;
        },

        transform(code, id) {
            return transformLoader(code, id, loaderPath(), bindingReferenceId);
        },
    };
}

export { gtkxNative };
