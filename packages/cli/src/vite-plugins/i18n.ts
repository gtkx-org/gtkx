import type { ConfigLoader } from "@gtkx/config";
import type { Plugin, ResolvedConfig } from "vite";
import { createConfigLoader } from "@gtkx/config/internal";
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import {
    type CatalogProject,
    compileCatalogs,
    LOCALE_DIRNAME,
    resolveCatalogProject,
} from "../i18n/catalogs.js";
import { metadataTemplateFiles } from "../i18n/metadata-templates.js";
import { runCliTool } from "../internal/run-cli-tool.js";
import { stripQuery } from "./strip-query.js";

type I18nState = {
    entryPath: string;
    i18nRoot: string;
    outDir: string;
    project: CatalogProject | null;
};

type BundleOutput = {
    type: string;
    moduleIds?: string[] | undefined;
};

const BOOTSTRAP_SPECIFIER = "@gtkx/i18n/bootstrap";
const POTFILES_FILENAME = "POTFILES.in";
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const NODE_MODULES_PATH = /(?:^|[/\\])node_modules(?:[/\\]|$)/;
const LOCALE_URL_PLACEHOLDER = "__GTKX_BUNDLE_LOCALE_DIR__";
const LOCALE_MODULE_PATHS = new Set(["dist/locale.js", "src/locale.ts"]);
const LOCALE_URL_PATTERN = /new URL\((["'])locale\1,\s*import\.meta\.url\)/;

const projectSource = (root: string, id: string): string | null => {
    const path = stripQuery(id);

    if (!isAbsolute(path) || !SOURCE_EXTENSION.test(path) || NODE_MODULES_PATH.test(path)) {
        return null;
    }

    const projectPath = relative(root, path);

    if (projectPath === "" || projectPath === ".." || projectPath.startsWith(`..${sep}`) || isAbsolute(projectPath)) {
        return null;
    }

    return projectPath.replaceAll("\\", "/");
};

const sourceModuleIds = (bundle: Record<string, BundleOutput>): string[] =>
    Object.values(bundle).flatMap((output) => (output.type === "chunk" ? output.moduleIds ?? [] : []));

const writePotfiles = (project: CatalogProject, bundle: Record<string, BundleOutput>): string => {
    const paths = sourceModuleIds(bundle)
        .map((id) => projectSource(project.root, id))
        .filter((path) => path !== null);

    const sorted = [...new Set(paths)].toSorted((left, right) => left.localeCompare(right));
    const target = resolve(project.poDir, POTFILES_FILENAME);
    writeFileSync(target, sorted.length === 0 ? "" : `${sorted.join("\n")}\n`);

    return target;
};

const extractSourceMessages = (project: CatalogProject, potfilesPath: string, output: string): void => {
    runCliTool({
        tool: "xgettext",
        args: [
            "--language=JavaScript",
            "--from-code=UTF-8",
            "--force-po",
            "--keyword=gettext:1",
            "--keyword=_:1",
            "--keyword=ngettext:1,2",
            "--keyword=pgettext:1c,2",
            "--keyword=npgettext:1c,2,3",
            "--keyword=t:1",
            `--directory=${project.root}`,
            `--files-from=${potfilesPath}`,
            `--output=${output}`,
        ],
        target: output,
    });
};

const extractMetadataFragment = (project: CatalogProject, input: string, output: string): void => {
    runCliTool({
        tool: "msggrep",
        args: [
            "--force-po",
            `--output-file=${output}`,
            ...metadataTemplateFiles(project).map((file) => `--location=${file.relativePath}`),
            input,
        ],
        target: input,
    });
};

const joinMetadataFragment = (output: string, fragment: string): void => {
    runCliTool({
        tool: "xgettext",
        args: [
            "--language=PO",
            "--join-existing",
            "--force-po",
            `--output=${output}`,
            fragment,
        ],
        target: output,
    });
};

const extractCatalogTemplate = (
    project: CatalogProject,
    potfilesPath: string,
    shouldPreserveMetadataMessages: boolean,
): void => {
    const output = resolve(project.poDir, `${project.domain}.pot`);

    if (!shouldPreserveMetadataMessages || !existsSync(output)) {
        extractSourceMessages(project, potfilesPath, output);

        return;
    }

    const workDir = mkdtempSync(join(project.poDir, ".gtkx-i18n-"));
    const fragment = join(workDir, "metadata.pot");
    const source = join(workDir, "source.pot");

    try {
        extractMetadataFragment(project, output, fragment);
        extractSourceMessages(project, potfilesPath, source);
        joinMetadataFragment(source, fragment);
        renameSync(source, output);
    } finally {
        rmSync(workDir, { recursive: true, force: true });
    }
};

const isI18nLocaleModule = (state: I18nState, id: string): boolean => {
    if (state.i18nRoot.length === 0) {
        return false;
    }

    const path = relative(state.i18nRoot, stripQuery(id)).replaceAll("\\", "/");

    return LOCALE_MODULE_PATHS.has(path);
};

const markLocaleUrl = (code: string): string =>
    code.replace(
        LOCALE_URL_PATTERN,
        () => `new URL(${JSON.stringify(LOCALE_URL_PLACEHOLDER)}, import.meta.url)`,
    );

const localeUrlForChunk = (fileName: string): string => {
    const path = posix.relative(posix.dirname(fileName), LOCALE_DIRNAME);

    return path.length === 0 ? "." : path;
};

const rebaseLocaleUrl = (state: I18nState, code: string, fileName: string, moduleIds: string[]): string | null => {
    if (moduleIds.every((id) => !isI18nLocaleModule(state, id))) {
        return null;
    }

    const placeholder = JSON.stringify(LOCALE_URL_PLACEHOLDER);

    if (!code.includes(placeholder)) {
        throw new Error(`Unable to locate the @gtkx/i18n locale fallback in ${fileName}`);
    }

    return code.replace(placeholder, () => JSON.stringify(localeUrlForChunk(fileName)));
};

const applyResolvedConfig = async (
    state: I18nState,
    config: ResolvedConfig,
    loadConfig: ConfigLoader,
): Promise<void> => {
    state.entryPath = resolve(config.root, state.entryPath);
    state.outDir = resolve(config.root, config.build.outDir);
    const application = await loadConfig.resolve(config.root);
    state.project = resolveCatalogProject(config.root, application.applicationId);

    if (state.project !== null) {
        const projectRequire = createRequire(resolve(config.root, "package.json"));
        state.i18nRoot = dirname(projectRequire.resolve("@gtkx/i18n/package.json"));
    }
};

const buildCatalogs = (
    state: I18nState,
    bundle: Record<string, BundleOutput>,
    shouldPreserveMetadataMessages: boolean,
): void => {
    const project = state.project;

    if (project === null) {
        return;
    }

    const potfilesPath = writePotfiles(project, bundle);
    extractCatalogTemplate(project, potfilesPath, shouldPreserveMetadataMessages);
    mkdirSync(state.outDir, { recursive: true });
    compileCatalogs(project, resolve(state.outDir, LOCALE_DIRNAME));
};

const gtkxI18n = (
    entryPath: string,
    loadConfig: ConfigLoader = createConfigLoader(),
    shouldPreserveMetadataMessages = true,
): Plugin => {
    const state: I18nState = { entryPath, i18nRoot: "", outDir: "", project: null };

    return {
        name: "gtkx:i18n",
        enforce: "pre",

        configResolved: (config) => applyResolvedConfig(state, config, loadConfig),

        transform(code, id) {
            if (isI18nLocaleModule(state, id)) {
                return markLocaleUrl(code);
            }

            if (state.project === null || resolve(stripQuery(id)) !== state.entryPath) {
                return;
            }

            return `import ${JSON.stringify(BOOTSTRAP_SPECIFIER)};\n${code}`;
        },

        renderChunk(code, chunk) {
            return rebaseLocaleUrl(state, code, chunk.fileName, chunk.moduleIds);
        },

        generateBundle(_options, bundle) {
            buildCatalogs(state, bundle, shouldPreserveMetadataMessages);
        },
    };
};

export { gtkxI18n };
