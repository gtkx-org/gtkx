import { BUNDLE_FILENAME } from "../vite-plugins/gresource-protocol.js";

const buildInitModuleSource = (): string =>
    [
        `import { dirname, join } from "node:path";`,
        `import { fileURLToPath } from "node:url";`,
        `import { resourceLoad, resourcesRegister } from "@gtkx/gi/gio";`,
        ``,
        `const bundleDir = dirname(fileURLToPath(import.meta.url));`,
        `const resource = resourceLoad(join(bundleDir, ${JSON.stringify(BUNDLE_FILENAME)}));`,
        `resourcesRegister(resource);`,
        ``,
        `export function ensureRegistered() {}`,
        `export function __refresh() {}`,
    ].join("\n");

const devInitModuleSource = (bundlePath: string): string => {
    const bundlePathLiteral = JSON.stringify(bundlePath);
    return [
        `import { statSync } from "node:fs";`,
        `import { resourceLoad, resourcesRegister, resourcesUnregister } from "@gtkx/gi/gio";`,
        ``,
        `let current = null;`,
        `let lastSig = "";`,
        ``,
        `function register() {`,
        `    const next = resourceLoad(${bundlePathLiteral});`,
        `    if (current) resourcesUnregister(current);`,
        `    resourcesRegister(next);`,
        `    current = next;`,
        `}`,
        ``,
        `export function ensureRegistered() {`,
        `    const { size, mtimeMs } = statSync(${bundlePathLiteral});`,
        `    const sig = size + ":" + mtimeMs;`,
        `    if (sig === lastSig) return;`,
        `    register();`,
        `    lastSig = sig;`,
        `}`,
        ``,
        `ensureRegistered();`,
        ``,
        `export function __refresh() {`,
        `    register();`,
        `    const { size, mtimeMs } = statSync(${bundlePathLiteral});`,
        `    lastSig = size + ":" + mtimeMs;`,
        `}`,
    ].join("\n");
};

/**
 * Renders the JavaScript source of the GResource init module: a build-mode
 * registrar that loads the emitted bundle next to itself, or a dev-mode
 * registrar that re-registers a staged bundle on change.
 *
 * @param options - Whether this is a build and, for dev, the staged bundle path.
 * @returns The init module source.
 */
export const renderInitModule = (options: { isBuild: boolean; devBundlePath: string }): string =>
    options.isBuild ? buildInitModuleSource() : devInitModuleSource(options.devBundlePath);
