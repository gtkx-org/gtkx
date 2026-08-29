import type { I18nextToolkitConfig, Logger, Plugin } from "i18next-cli";
import { runTypesGenerator } from "i18next-cli";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const CONTEXT_SEPARATOR = "\u{4}";
const DEFAULT_NAMESPACE = "translation";
const I18N_TYPES_FILENAME = "i18n.d.ts";
const I18N_RESOURCES_FILENAME = "i18n-resources.d.ts";

const generatedDir = (root: string): string => join(root, "node_modules", ".gtkx");
const i18nResourceDir = (root: string): string => join(generatedDir(root), "i18n");
const i18nTypesPath = (root: string): string => join(generatedDir(root), I18N_TYPES_FILENAME);
const i18nResourcesPath = (root: string): string => join(generatedDir(root), I18N_RESOURCES_FILENAME);

const clearI18nResources = (root: string): void => {
    rmSync(i18nResourceDir(root), { force: true, recursive: true });
};

const i18nToolkitConfig = (
    root: string,
    sourceFiles: string[],
    plugins: Plugin[] = [],
): I18nextToolkitConfig => ({
    locales: ["en"],
    plugins,
    extract: {
        contextSeparator: CONTEXT_SEPARATOR,
        defaultNS: DEFAULT_NAMESPACE,
        disablePlurals: false,
        extractFromComments: false,
        functions: ["t"],
        generateBasePluralForms: false,
        input: sourceFiles,
        keySeparator: ".",
        nsSeparator: false,
        output: join(i18nResourceDir(root), "{{language}}", "{{namespace}}.json"),
        pluralSeparator: "_",
        primaryLanguage: "en",
        removeUnusedKeys: true,
        transComponents: ["Trans", "TransWithoutContext"],
        useTranslationNames: ["useTranslation"],
        warnOnConflicts: "error",
    },
    types: {
        input: join(i18nResourceDir(root), "en", "*.json"),
        output: i18nTypesPath(root),
        resourcesFile: i18nResourcesPath(root),
    },
});

const declarations = (): string => `import type Resources from "./i18n-resources.js";

declare module "@gtkx/i18n" {
    interface I18nResources extends Resources {}
}
`;

const writeChanged = (path: string, content: string): void => {
    let current: string | null;

    try {
        current = readFileSync(path, "utf8");
    } catch {
        current = null;
    }

    if (current === content) {
        return;
    }

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
};

const typegenLogger = (): { errors: string[]; logger: Logger } => {
    const errors: string[] = [];

    return {
        errors,
        logger: {
            error(value) {
                errors.push(String(value));
            },
            info() {
                return;
            },
            warn() {
                return;
            },
        },
    };
};

const emitI18nTypes = async (root: string): Promise<void> => {
    const typesPath = i18nTypesPath(root);
    const resourcesPath = i18nResourcesPath(root);
    writeChanged(typesPath, declarations());
    const { errors, logger } = typegenLogger();
    await runTypesGenerator(i18nToolkitConfig(root, []), { logger, quiet: true });

    if (errors.length > 0 || !existsSync(typesPath) || !existsSync(resourcesPath)) {
        throw new Error(errors.join("\n") || "i18next type generation did not produce its outputs");
    }
};

const clearI18nTypes = (root: string): void => {
    rmSync(i18nTypesPath(root), { force: true });
    rmSync(i18nResourcesPath(root), { force: true });
    clearI18nResources(root);
};

export {
    I18N_TYPES_FILENAME,
    clearI18nResources,
    clearI18nTypes,
    emitI18nTypes,
    i18nToolkitConfig,
    i18nTypesPath,
};
