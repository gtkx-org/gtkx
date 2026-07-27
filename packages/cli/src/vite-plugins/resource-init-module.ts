import { BUNDLE_FILENAME, REFRESH_EXPORT } from "./resource-shared.js";

const buildInitModuleSource = (): string =>
    [
        "import { dirname, join } from \"node:path\";",
        "import { fileURLToPath } from \"node:url\";",
        "import { Resource, resourcesRegister } from \"@gtkx/gi/gio\";",
        "",
        "const bundleDir = dirname(fileURLToPath(import.meta.url));",
        `const resource = Resource.load(join(bundleDir, ${JSON.stringify(BUNDLE_FILENAME)}));`,
        "resourcesRegister(resource);",
        "",
        "export function ensureRegistered() {}",
        `export function ${REFRESH_EXPORT}() {}`,
    ].join("\n");

const devInitModuleSource = (bundlePath: string): string => {
    const bundlePathLiteral = JSON.stringify(bundlePath);

    return [
        "import { existsSync, statSync } from \"node:fs\";",
        "import { Resource, resourcesRegister, resourcesUnregister } from \"@gtkx/gi/gio\";",
        "",
        "let current = null;",
        "let lastSig = \"\";",
        "",
        "function register() {",
        `    const next = Resource.load(${bundlePathLiteral});`,
        "    if (current) resourcesUnregister(current);",
        "    resourcesRegister(next);",
        "    current = next;",
        "}",
        "",
        "export function ensureRegistered() {",
        `    if (!existsSync(${bundlePathLiteral})) return;`,
        `    const { size, mtimeMs } = statSync(${bundlePathLiteral});`,
        "    const sig = size + \":\" + mtimeMs;",
        "    if (sig === lastSig) return;",
        "    register();",
        "    lastSig = sig;",
        "}",
        "",
        "ensureRegistered();",
        "",
        `export function ${REFRESH_EXPORT}() {`,
        `    if (!existsSync(${bundlePathLiteral})) return;`,
        "    register();",
        `    const { size, mtimeMs } = statSync(${bundlePathLiteral});`,
        "    lastSig = size + \":\" + mtimeMs;",
        "}",
    ].join("\n");
};

const renderInitModule = (options: { isBuild: boolean; devBundlePath: string }): string =>
    options.isBuild ? buildInitModuleSource() : devInitModuleSource(options.devBundlePath);

export { renderInitModule };
