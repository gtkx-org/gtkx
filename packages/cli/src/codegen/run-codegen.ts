import { resolveStore } from "@gtkx/codegen";
import {
    type CodegenInputs,
    generateBindings,
    getShadowingStorePaths,
    isCodegenStale,
    readGiStoreGirFiles,
    resolveCodegenInputs,
    sweepProjectStaging,
} from "@gtkx/codegen/internal";
import type { Config, LoadConfigOptions } from "@gtkx/config";
import { createConfigReloader, isAgentReferenceEnabled, isAgentRulesEnabled } from "@gtkx/config/internal";
import { info } from "@gtkx/utils";
import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { packageManagers } from "nypm";
import { resolveCatalogProject, synchronizeCatalogs } from "../i18n/catalogs.js";
import { extractSourceCatalog } from "../i18n/source-messages.js";
import { clearI18nTypes, emitI18nTypes } from "../i18n/types.js";
import { removeAgentRules, upsertAgentRules } from "../internal/agent-rules.js";
import { discoverSourceFiles } from "../internal/source-imports.js";
import { emitSchemaEnv } from "../settings/schema.js";
import { type ReferenceResult, writeReference } from "./reference.js";
import { type CodegenContext, resolveCodegenContext } from "./store-resolver.js";

type RunCodegenOptions = {
    cwd: string;
    resolved: LoadedConfig;
    isForced?: boolean;
    lockTimeoutMs?: number | undefined;
    inputs?: CodegenInputs;
    shouldPreserveI18nMetadata?: boolean | undefined;
    onRegenerate?: (() => void) | undefined;
};

type LoadedConfig = Pick<CodegenContext, "config" | "configFile" | "isApplication" | "translationDomain">;

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

type EnsureGeneratedOptions = {
    shouldAnnounce?: boolean;
    lockTimeoutMs?: number | undefined;
    mode?: string;
    configFile?: string | undefined;
    defaultApplicationId?: string | undefined;
    shouldPreserveI18nMetadata?: boolean | undefined;
};

const removeStores = (paths: string[]): void => {
    for (const path of paths) {
        rmSync(path, { recursive: true, force: true });
    }
};

const removeShadowingStores = (cwd: string, config: Config): void => {
    sweepProjectStaging(cwd);
    removeStores(getShadowingStorePaths(cwd, config.codegen !== false));
};

const disabledCodegenResult = (configFile: string): RunCodegenResult => ({
    isRegenerated: false,
    namespaces: 0,
    intrinsicElements: 0,
    duration: 0,
    girPath: [],
    configFile,
    libraries: [],
});

const runCodegen = async (options: RunCodegenOptions): Promise<RunCodegenResult> => {
    const { cwd } = options;
    const { config, configFile, isApplication, translationDomain } = options.resolved;
    await syncI18n(cwd, translationDomain, options.shouldPreserveI18nMetadata);
    emitSchemaEnv(cwd);

    removeShadowingStores(cwd, config);

    if (config.codegen === false) {
        return disabledCodegenResult(configFile);
    }

    const result = await generateBindings({
        cwd,
        config,
        ...(options.inputs !== undefined && { inputs: options.inputs }),
        isForced: options.isForced === true,
        lockTimeoutMs: options.lockTimeoutMs,
        onRegenerate: options.onRegenerate,
    });
    const { girPath, libraries, store, isForced } = result;

    const reference = await writeReference({
        root: cwd,
        config,
        girPath,
        libraries,
        isForced,
        isEnabled: isAgentReferenceEnabled(config, isApplication),
        declarationDir: store.giStoreDir,
    });

    if (isAgentRulesEnabled(config, isApplication)) {
        upsertAgentRules(cwd, isAgentReferenceEnabled(config, isApplication));
    } else {
        removeAgentRules(cwd);
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

const syncI18n = async (root: string, domain: string, shouldPreserveMetadataMessages = true): Promise<void> => {
    const project = resolveCatalogProject(root, domain);

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

const resolveInputsOrNull = (cwd: string, config: Config): CodegenInputs | null => {
    try {
        return resolveCodegenInputs(cwd, config);
    } catch {
        return null;
    }
};

const regenerationAnnouncement = (
    shouldAnnounce: boolean | undefined,
    inputs: CodegenInputs | null,
): (() => void) | undefined => {
    if (!shouldAnnounce) {
        return undefined;
    }

    const state = inputs === null || isCodegenStale(inputs) ? "missing" : "out of date";

    return () => info(`generated bindings ${state}; running codegen...`);
};

const generate = async (context: CodegenContext, options: EnsureGeneratedOptions): Promise<boolean> => {
    if (context.config.codegen === false) {
        const result = await runCodegen({
            cwd: context.root,
            lockTimeoutMs: options.lockTimeoutMs,
            resolved: context,
            shouldPreserveI18nMetadata: options.shouldPreserveI18nMetadata,
        });

        return result.isRegenerated;
    }

    const inputs = resolveInputsOrNull(context.root, context.config);

    const result = await runCodegen({
        cwd: context.root,
        lockTimeoutMs: options.lockTimeoutMs,
        resolved: context,
        shouldPreserveI18nMetadata: options.shouldPreserveI18nMetadata,
        onRegenerate: regenerationAnnouncement(options.shouldAnnounce, inputs),
        ...(inputs !== null && { inputs }),
    });

    return result.isRegenerated;
};

const ensureGeneratedIn = async (context: CodegenContext, options: EnsureGeneratedOptions = {}): Promise<boolean> =>
    generate(context, options);

const ensureGenerated = async (cwd: string, options: EnsureGeneratedOptions = {}): Promise<boolean> =>
    generate(
        await resolveCodegenContext(cwd, {
            mode: options.mode,
            configFile: options.configFile,
            defaultApplicationId: options.defaultApplicationId,
        }),
        options,
    );

const LOCKFILE_NAMES = packageManagers.flatMap(({ lockFile }) => lockFile ?? []);

const findLockfiles = (cwd: string): string[] => {
    const directory = resolve(cwd);
    const found = LOCKFILE_NAMES.map((name) => join(directory, name)).filter((path) => existsSync(path));
    const parent = dirname(directory);

    return found.length > 0 || parent === directory ? found : findLockfiles(parent);
};

const resolveConfigWatch = async (
    cwd: string,
    options: Pick<LoadConfigOptions, "configFile" | "defaultApplicationId" | "mode">,
    initialDependencies: string[] = [],
): Promise<{
    paths: string[];
    inputs: string[];
    resolvePaths: () => string[];
    resolveInputs: () => string[];
    regenerate: () => Promise<string[]>;
}> => {
    const { reload, resolvePaths } = await createConfigReloader(cwd, options, initialDependencies);
    const resolveInputs = (): string[] => [
        ...readGiStoreGirFiles(resolveStore(cwd).gi.storeDir),
        ...findLockfiles(cwd),
    ];

    return {
        paths: resolvePaths(),
        inputs: resolveInputs(),
        resolvePaths,
        resolveInputs,
        regenerate: async () => {
            const loaded = await reload();
            await runCodegen({ cwd, resolved: loaded });

            return resolvePaths();
        },
    };
};

export { runCodegen, ensureGenerated, ensureGeneratedIn, resolveConfigWatch, type RunCodegenResult };
