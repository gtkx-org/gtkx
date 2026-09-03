import { runCodegen as runCodegenCore } from "@gtkx/codegen";
import { getShadowingStorePaths, sweepProjectStaging } from "@gtkx/codegen/internal";
import { type Config, loadConfig } from "@gtkx/config";
import {
    isAgentRulesEnabled,
    resolveElementComponents,
    resolveElementProps,
    resolveLazyElements,
    resolveOmittedProps,
} from "@gtkx/config/internal";
import { info } from "@gtkx/utils";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveCatalogProject, synchronizeCatalogs } from "../i18n/catalogs.js";
import { extractSourceCatalog } from "../i18n/source-messages.js";
import { clearI18nTypes, emitI18nTypes } from "../i18n/types.js";
import { upsertAgentRules } from "../internal/agent-rules.js";
import { discoverSourceFiles } from "../internal/source-imports.js";
import { emitSchemaEnv } from "../settings/schema.js";
import { type CodegenInputs, isCodegenStale, resolveCodegenInputs } from "./freshness.js";
import { type ReferenceResult, writeReference } from "./reference.js";
import { type CodegenContext, type CodegenStore, resolveCodegenContext } from "./store-resolver.js";

type RunCodegenOptions = {
    cwd?: string;
    mode?: string | undefined;
    configFile?: string | undefined;
    isForced?: boolean;
    inputs?: CodegenInputs;
    resolved?: LoadedConfig;
    shouldPreserveI18nMetadata?: boolean | undefined;
};

type LoadedConfig = {
    config: Config;
    configFile: string;
};

type RunCodegenResult = {
    isRegenerated: boolean;
    namespaces: number;
    intrinsicElements: number;
    duration: number;
    girPath: string[];
    configFile: string;
    libraries: string[];
    reference?: ReferenceResult | undefined;
};

type CodegenOptionsInput = {
    store: CodegenStore;
    libraries: string[];
    girPath: string[];
    elements: Config["elements"];
};

type PreparedCodegen = CodegenInputs & { isForced: boolean };

type EnsureGeneratedOptions = {
    shouldAnnounce?: boolean;
    mode?: string;
    configFile?: string | undefined;
    shouldPreserveI18nMetadata?: boolean | undefined;
};

const GIR_PATH_MISSING_MESSAGE =
    "No GIR search paths available. Install gobject-introspection " +
    "(Linux: `sudo dnf install gobject-introspection-devel` or `sudo apt install libgirepository1.0-dev`), " +
    "or set `girPath` in gtkx.config.ts.";

const removeStores = (paths: string[]): void => {
    for (const path of paths) {
        rmSync(path, { recursive: true, force: true });
    }
};

const removeShadowingStores = (cwd: string): void => {
    sweepProjectStaging(cwd);
    removeStores(getShadowingStorePaths(cwd));
};

const codegenOptions = ({ store, libraries, girPath, elements }: CodegenOptionsInput) => ({
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
    userComponents: resolveElementComponents(elements),
    userProps: resolveElementProps(elements),
    userLazyElements: resolveLazyElements(elements),
    userOmittedProps: resolveOmittedProps(elements),
});

const disabledCodegenResult = (configFile: string): RunCodegenResult => ({
    isRegenerated: false,
    namespaces: 0,
    intrinsicElements: 0,
    duration: 0,
    girPath: [],
    configFile,
    libraries: [],
});

const prepareCodegen = (options: RunCodegenOptions, cwd: string, config: Config): PreparedCodegen => {
    const { girPath, libraries, store } = options.inputs ?? resolveCodegenInputs(cwd, config);

    if (girPath.length === 0) {
        throw new Error(GIR_PATH_MISSING_MESSAGE);
    }

    const isForced = options.isForced === true || isCodegenStale({ girPath, libraries, store });

    return { girPath, libraries, store, isForced };
};

const runCodegen = async (options: RunCodegenOptions = {}): Promise<RunCodegenResult> => {
    const cwd = options.cwd ?? process.cwd();
    const { config, configFile } = options.resolved ?? (await loadConfig(cwd, {
        mode: options.mode,
        configFile: options.configFile,
    }));
    await syncI18n(cwd, config.applicationId, options.shouldPreserveI18nMetadata);
    emitSchemaEnv(cwd);

    if (config.codegen === false) {
        removeShadowingStores(cwd);

        return disabledCodegenResult(configFile);
    }

    const { girPath, libraries, store, isForced } = prepareCodegen(options, cwd, config);

    const result = await runCodegenCore({
        ...codegenOptions({ store, libraries, girPath, elements: config.elements }),
        isForced,
    });

    const reference = await writeReference({ root: cwd, config, girPath, libraries, isForced });

    if (isAgentRulesEnabled(config)) {
        upsertAgentRules(cwd);
    }

    return {
        isRegenerated: result.isRegenerated,
        namespaces: result.namespaces,
        intrinsicElements: result.intrinsicElements,
        duration: result.duration,
        girPath,
        configFile,
        libraries,
        reference,
    };
};

const syncI18n = async (
    root: string,
    applicationId: string,
    shouldPreserveMetadataMessages = true,
): Promise<void> => {
    const project = resolveCatalogProject(root, applicationId);

    if (project === null) {
        clearI18nTypes(root);

        return;
    }

    const srcDir = join(root, "src");
    const sourceFiles = discoverSourceFiles(existsSync(srcDir) ? srcDir : root);
    await extractSourceCatalog(project, sourceFiles, shouldPreserveMetadataMessages);
    synchronizeCatalogs(project);
    await emitI18nTypes(root);
};

const isCodegenDisabled = async (cwd: string, mode?: string, configFile?: string): Promise<boolean> => {
    try {
        const { config } = await loadConfig(cwd, { mode, configFile });

        return config.codegen === false;
    } catch {
        return false;
    }
};

const resolveInputsOrNull = (cwd: string, config: Config): CodegenInputs | null => {
    try {
        return resolveCodegenInputs(cwd, config);
    } catch {
        return null;
    }
};

const maybeAnnounceStale = (shouldAnnounce: boolean | undefined, inputs: CodegenInputs | null): void => {
    if (!shouldAnnounce) {
        return;
    }

    if (inputs === null || isCodegenStale(inputs)) {
        info("generated bindings missing; running codegen...");
    }
};

const isPreflightSkipped = (options: EnsureGeneratedOptions): boolean =>
    options.shouldAnnounce === true && process.env.GTKX_DISABLE_PREFLIGHT === "1";

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether codegen ran */
const generate = async (context: CodegenContext, options: EnsureGeneratedOptions): Promise<boolean> => {
    if (context.config.codegen === false) {
        const result = await runCodegen({
            cwd: context.root,
            mode: options.mode,
            resolved: { config: context.config, configFile: context.configFile },
            shouldPreserveI18nMetadata: options.shouldPreserveI18nMetadata,
        });

        return result.isRegenerated;
    }

    const inputs = resolveInputsOrNull(context.root, context.config);
    maybeAnnounceStale(options.shouldAnnounce, inputs);
    const resolved = { config: context.config, configFile: context.configFile };

    const result = await runCodegen({
        cwd: context.root,
        mode: options.mode,
        resolved,
        shouldPreserveI18nMetadata: options.shouldPreserveI18nMetadata,
        ...(inputs !== null && { inputs }),
    });

    return result.isRegenerated;
};

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether codegen ran */
const ensureGeneratedIn = async (
    context: CodegenContext,
    options: EnsureGeneratedOptions = {},
): Promise<boolean> => (isPreflightSkipped(options) ? false : generate(context, options));

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether codegen ran */
const ensureGenerated = async (cwd: string, options: EnsureGeneratedOptions = {}): Promise<boolean> =>
    isPreflightSkipped(options)
        ? false
        : generate(await resolveCodegenContext(cwd, options.mode, options.configFile), options);

const resolveConfigWatch = async (
    cwd: string,
    mode?: string,
    configFile?: string,
): Promise<{ paths: string[]; regenerate: () => Promise<void> }> => {
    const loaded = await loadConfig(cwd, { mode, configFile });

    return {
        paths: [resolve(loaded.root, loaded.configFile)],
        regenerate: async () => {
            await runCodegen({ cwd: loaded.root, mode, configFile: loaded.configFile });
        },
    };
};

export {
    runCodegen,
    isCodegenDisabled,
    ensureGenerated,
    ensureGeneratedIn,
    resolveConfigWatch,
    type RunCodegenResult,
};
