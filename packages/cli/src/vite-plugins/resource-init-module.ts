import { REFRESH_EXPORT, REGISTER_REFRESH_EXPORT } from "./resource-shared.js";

type InitModuleOptions = { isBuild: true; bundleReferenceId: string } |
    { isBuild: false; devBundlePath: string };

const refreshCallbackSource = (): string[] => [
    "const refreshCallbacks = new Map();",
    "",
    `export function ${REGISTER_REFRESH_EXPORT}(key, callback) {`,
    "    refreshCallbacks.set(key, callback);",
    "    callback();",
    "}",
    "",
    "function runRefreshCallbacks() {",
    "    for (const callback of refreshCallbacks.values()) callback();",
    "}",
];

const buildInitModuleSource = (bundleReferenceId: string): string =>
    [
        "import { fileURLToPath } from \"node:url\";",
        "import { Resource, resourcesRegister } from \"@gtkx/gi/gio\";",
        "",
        `const bundleLocation = import.meta.ROLLUP_FILE_URL_${bundleReferenceId};`,
        "const bundlePath = bundleLocation.startsWith(\"file:\") ? fileURLToPath(bundleLocation) : bundleLocation;",
        "const resource = Resource.load(bundlePath);",
        "resourcesRegister(resource);",
        "",
        ...refreshCallbackSource(),
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
        "function unregister() {",
        "    if (!current) return;",
        "    resourcesUnregister(current);",
        "    current = null;",
        "    lastSig = \"\";",
        "}",
        "",
        ...refreshCallbackSource(),
        "",
        "export function ensureRegistered() {",
        `    if (!existsSync(${bundlePathLiteral})) {`,
        "        unregister();",
        "        return;",
        "    }",
        `    const { size, mtimeMs } = statSync(${bundlePathLiteral});`,
        "    const sig = size + \":\" + mtimeMs;",
        "    if (sig !== lastSig) {",
        "        register();",
        "        lastSig = sig;",
        "    }",
        "}",
        "",
        "ensureRegistered();",
        "",
        `export function ${REFRESH_EXPORT}() {`,
        "    ensureRegistered();",
        "    runRefreshCallbacks();",
        "}",
    ].join("\n");
};

const renderInitModule = (options: InitModuleOptions): string =>
    options.isBuild ? buildInitModuleSource(options.bundleReferenceId) : devInitModuleSource(options.devBundlePath);

export { renderInitModule };
