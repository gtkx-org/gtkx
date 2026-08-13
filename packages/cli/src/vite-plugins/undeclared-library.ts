import type { StoreOptions } from "@gtkx/codegen";
import type { ConfigLoader } from "@gtkx/config";
import type { Plugin, UserConfig } from "vite";
import { discoverGirNamespaces, resolveGirPath, resolveStore } from "@gtkx/codegen";
import { createConfigLoader } from "@gtkx/config/internal";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type PluginState = {
    root: string;
    loadConfig: ConfigLoader;
    girPath: string[] | null;
};

type GeneratedModule = {
    source: string;
    kind: string;
    namespace: string;
    importer: string;
};

const GENERATED_MODULE_PATTERN = /^@gtkx\/(gi|jsx)\/([a-z0-9]+)$/;

const girSearchPaths = async (state: PluginState): Promise<string[]> => {
    if (state.girPath === null) {
        const { config } = await state.loadConfig.load(state.root);
        state.girPath = resolveGirPath(config.girPath);
    }

    return state.girPath;
};

const getNamespace = (identifier: string): string => identifier.slice(0, identifier.indexOf("-")).toLowerCase();

const findGirIdentifier = (girPath: string[], namespace: string): string | undefined =>
    discoverGirNamespaces(girPath).find((identifier) => getNamespace(identifier) === namespace);

const parseGeneratedModule = (source: string, importer: string | undefined): GeneratedModule | null => {
    const matched = GENERATED_MODULE_PATTERN.exec(source);
    const kind = matched?.[1];
    const namespace = matched?.[2];

    if (kind === undefined || namespace === undefined) {
        return null;
    }

    return { source, kind, namespace, importer: importer ?? "the project's sources" };
};

const getStoreOptions = (root: string, kind: string): StoreOptions | null => {
    try {
        const store = resolveStore(root);

        return kind === "gi" ? store.gi : store.jsx;
    } catch {
        return null;
    }
};

const hasNamespaceModule = (storeDir: string, namespace: string): boolean => {
    const manifest = join(storeDir, "package.json");

    if (!existsSync(manifest)) {
        return false;
    }

    const { exports } = JSON.parse(readFileSync(manifest, "utf8")) as { exports?: Record<string, unknown> };

    return exports?.[`./${namespace}`] !== undefined;
};

const unreachableStoreError = (generated: GeneratedModule, options: StoreOptions): Error =>
    new Error(
        `Cannot resolve "${generated.source}": the generated store in ${options.storeDir} does provide ` +
        `"${generated.namespace}", but its link at ${options.linkDir} is not on the module resolution path of ` +
        `${generated.importer}. Codegen writes the store into the node_modules the installed @gtkx packages ` +
        "resolve from; install them where the importing file reaches them, then run gtkx codegen again.",
    );

const undeclaredLibraryError = (generated: GeneratedModule, girPath: string[]): Error => {
    const identifier = findGirIdentifier(girPath, generated.namespace);

    if (identifier === undefined) {
        return new Error(
            `Cannot resolve "${generated.source}": the binding store has no "${generated.namespace}" module, and no ` +
            `GIR data for it was found in [${girPath.join(", ")}]. If "${generated.namespace}" is a library, ` +
            "install its gobject-introspection data package and add its GIR identifier to `libraries` in " +
            "gtkx.config.ts. Otherwise run gtkx codegen to regenerate the store.",
        );
    }

    return new Error(
        `Cannot resolve "${generated.source}": the "${identifier}" bindings have not been generated. ` +
        `Add "${identifier}" to \`libraries\` in gtkx.config.ts, then run gtkx dev or gtkx build again.`,
    );
};

const unresolvedModuleError = async (state: PluginState, generated: GeneratedModule): Promise<Error> => {
    const options = getStoreOptions(state.root, generated.kind);

    if (options !== null && hasNamespaceModule(options.storeDir, generated.namespace)) {
        return unreachableStoreError(generated, options);
    }

    return undeclaredLibraryError(generated, await girSearchPaths(state));
};

function gtkxUndeclaredLibrary(loadConfig: ConfigLoader = createConfigLoader()): Plugin {
    const state: PluginState = {
        root: "",
        loadConfig,
        girPath: null,
    };

    return {
        name: "gtkx:undeclared-library",
        enforce: "pre",

        config(config: UserConfig) {
            state.root = config.root ?? process.cwd();
        },

        async resolveId(source, importer, options) {
            const generated = parseGeneratedModule(source, importer);

            if (generated === null) {
                return;
            }

            const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });

            if (resolved !== null) {
                return;
            }

            throw await unresolvedModuleError(state, generated);
        },
    };
}

export { gtkxUndeclaredLibrary };
