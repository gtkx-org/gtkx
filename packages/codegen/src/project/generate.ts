import type { Config } from "@gtkx/config";
import {
    resolveElementComponents,
    resolveElementProps,
    resolveLazyElements,
    resolveOmittedProps,
} from "@gtkx/config/internal";
import { type CodegenRunnerResult, runCodegen } from "../runner.js";
import { type CodegenInputs, isCodegenStale, resolveCodegenInputs } from "./freshness.js";

type GenerateBindingsOptions = {
    cwd: string;
    config: Config;
    inputs?: CodegenInputs;
    isForced?: boolean;
    lockTimeoutMs?: number | undefined;
};

type GenerateBindingsResult = CodegenRunnerResult & CodegenInputs & { isForced: boolean };

const GIR_PATH_MISSING_MESSAGE =
    "No GIR search paths available. Install gobject-introspection " +
    "(Linux: `sudo dnf install gobject-introspection-devel` or `sudo apt install libgirepository1.0-dev`), " +
    "or set `girPath` in gtkx.config.ts.";

const generateBindings = async (options: GenerateBindingsOptions): Promise<GenerateBindingsResult> => {
    const { config } = options;
    const inputs = options.inputs ?? resolveCodegenInputs(options.cwd, config);
    const { girPath, libraries, store } = inputs;

    if (girPath.length === 0) {
        throw new Error(GIR_PATH_MISSING_MESSAGE);
    }

    const isForced = options.isForced === true || isCodegenStale(inputs);
    const result = await runCodegen({
        libraries,
        girPath,
        gi: {
            storeDir: store.giStoreDir,
            linkDir: store.giLinkDir,
            version: store.runtimeVersion,
            owner: store.owner,
        },
        jsx:
            store.react === null
                ? undefined
                : {
                      storeDir: store.jsxStoreDir,
                      linkDir: store.jsxLinkDir,
                      version: store.react.version,
                      owner: store.owner,
                  },
        userComponents: resolveElementComponents(config.elements),
        userProps: resolveElementProps(config.elements),
        userLazyElements: resolveLazyElements(config.elements),
        userOmittedProps: resolveOmittedProps(config.elements),
        isForced,
        lockTimeoutMs: options.lockTimeoutMs,
    });

    return { ...result, ...inputs, isForced };
};

export { generateBindings };
