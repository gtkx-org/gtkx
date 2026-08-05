import type { ConfigLoader } from "@gtkx/config";
import type { Plugin, UserConfig } from "vite";
import { discoverGirNamespaces, resolveGirPath } from "@gtkx/codegen";
import { createConfigLoader } from "@gtkx/config/internal";

type PluginState = {
    root: string;
    loadConfig: ConfigLoader;
    girPath: string[] | null;
};

const GENERATED_MODULE_PATTERN = /^@gtkx\/(?:gi|jsx)\/([a-z0-9]+)$/;

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

const undeclaredLibraryError = (source: string, namespace: string, girPath: string[]): Error => {
    const identifier = findGirIdentifier(girPath, namespace);

    if (identifier === undefined) {
        return new Error(
            `Cannot resolve "${source}": the binding store has no "${namespace}" module, and no GIR data for it ` +
            `was found in [${girPath.join(", ")}]. If "${namespace}" is a library, install its ` +
            "gobject-introspection data package and add its GIR identifier to `libraries` in gtkx.config.ts. " +
            "Otherwise run gtkx codegen to regenerate the store.",
        );
    }

    return new Error(
        `Cannot resolve "${source}": the "${identifier}" bindings have not been generated. ` +
        `Add "${identifier}" to \`libraries\` in gtkx.config.ts, then run gtkx dev or gtkx build again.`,
    );
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
            const namespace = GENERATED_MODULE_PATTERN.exec(source)?.[1];

            if (namespace === undefined) {
                return;
            }

            const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });

            if (resolved !== null) {
                return;
            }

            throw undeclaredLibraryError(source, namespace, await girSearchPaths(state));
        },
    };
}

export { gtkxUndeclaredLibrary };
