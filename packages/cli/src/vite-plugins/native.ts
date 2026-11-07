import type { Plugin } from "vite";
import { readFileSync } from "node:fs";
import { arch, platform } from "node:os";
import { dirname, join, relative } from "node:path";
import { BINDING_FILENAME } from "../deploy/native-addon.js";
import { resolveBinding, resolveNativeManifest } from "../internal/native-binding.js";
import { isInstalled, packageForModule } from "./build-manifest.js";
import { stripQuery } from "./strip-query.js";

const ADDON_EXTENSION = ".node";
const ADDON_GUIDE_URL = "https://gtkx.dev/v2/guide/deploying#additional-native-addons";

function resolvePlatformBinary(root: string): Buffer {
    const currentPlatform = platform();

    if (currentPlatform !== "linux") {
        throw new Error(`Unsupported build platform: ${currentPlatform}, only Linux is supported`);
    }

    const currentArch = arch();

    if (currentArch !== "x64" && currentArch !== "arm64") {
        throw new Error(`Unsupported build architecture: ${currentArch}, only x64 and arm64 are supported`);
    }

    const binary = resolveBinding(root, currentArch);

    if (binary === undefined) {
        throw new Error(`Cannot find the @gtkx/native binary for linux-${currentArch}-gnu`);
    }

    return readFileSync(binary);
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
        'import { createRequire as __gtkxCreateRequire } from "node:module";',
        'import { fileURLToPath as __gtkxFileURLToPath } from "node:url";',
        `const __gtkxNativeLocation = import.meta.ROLLUP_FILE_URL_${bindingReferenceId};`,
        'const __gtkxNativePath = __gtkxNativeLocation.startsWith("file:") ' +
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

const isBundledAddon = (id: string): boolean => id.startsWith("/") && !id.includes("?") && id.endsWith(ADDON_EXTENSION);

const addonLoader = (root: string, importers: readonly string[]): string => {
    const importer = importers[0];

    if (importer === undefined) {
        return "A module";
    }

    const source = packageForModule(importer);

    return source !== null && isInstalled(source) ? source.manifest.name : relative(root, importer);
};

const addonUrlSpecifier = (root: string, addon: string): string => {
    const source = packageForModule(addon);

    return source !== null && isInstalled(source)
        ? `${source.manifest.name}/${relative(source.dir, addon)}?url`
        : `${relative(root, addon)}?url`;
};

const bundledAddonMessage = (root: string, addon: string, importers: readonly string[]): string =>
    `${addonLoader(root, importers)} loads the native addon ${relative(root, addon)}, which gtkx build cannot ` +
    `bundle. Import the addon file itself with ?url, such as "${addonUrlSpecifier(root, addon)}", and load it ` +
    'with createRequire; see "Additional native addons" in the Deploying guide: ' +
    `${ADDON_GUIDE_URL}`;

function gtkxNative(root: string): Plugin {
    let cachedLoaderPath: string | undefined;
    let bindingReferenceId: string | null = null;
    const bundledAddons: Set<string> = new Set();

    const loaderPath = (): string => {
        cachedLoaderPath ??= join(dirname(resolveNativeManifest(root)), "index.js");

        return cachedLoaderPath;
    };

    return {
        name: "gtkx:native",
        enforce: "pre",
        apply: "build",

        buildStart() {
            bundledAddons.clear();
            bindingReferenceId = this.emitFile({
                type: "asset",
                fileName: BINDING_FILENAME,
                source: resolvePlatformBinary(root),
            });
        },

        load(id) {
            if (!isBundledAddon(id)) {
                return null;
            }

            bundledAddons.add(id);

            return { code: "export {};", moduleType: "js" };
        },

        buildEnd(error) {
            const [addon] = bundledAddons;

            if (error === undefined && addon !== undefined) {
                this.error(bundledAddonMessage(root, addon, this.getModuleInfo(addon)?.importers ?? []));
            }
        },

        transform(code, id) {
            return transformLoader(code, id, loaderPath(), bindingReferenceId);
        },
    };
}

export { gtkxNative };
