import { loadConfigModule } from "@gtkx/config/internal";
import { isPathInside, sortStringsBy } from "@gtkx/utils";
import { globSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

type StorybookConfig = {
    stories: string[];
    exclude: string[];
    preview: string | undefined;
};

type StorybookFiles = {
    configPath: string | undefined;
    previewPath: string | undefined;
    stories: { id: string; title: string }[];
    skippedMdx: string[];
};

const STORYBOOK_CONFIG_BASE = ".storybook/main";
const STORYBOOK_PREVIEW_BASE = ".storybook/preview";
const CONFIG_EXTENSIONS = [".ts", ".js", ".mts", ".mjs"];
const PREVIEW_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"];
const DEFAULT_STORIES = ["src/**/*.stories.{ts,tsx,js,jsx,mts,mjs}"];
const MDX_EXTENSION = ".mdx";
const DEFAULT_EXCLUDES = ["**/node_modules/**", "**/.git/**", "**/.gtkx/**", "**/dist/**", "**/build/**"];

const isFile = (path: string): boolean => statSync(path, { throwIfNoEntry: false })?.isFile() === true;

const isMdx = (path: string): boolean => extname(path) === MDX_EXTENSION;

const findConfigFile = (root: string, base: string, extensions: string[]): string | undefined =>
    extensions.map((extension) => resolve(root, `${base}${extension}`)).find((path) => isFile(path));

const projectPath = (root: string, path: string): string => {
    const absolute = resolve(root, path);

    if (!isPathInside(root, absolute)) {
        throw new Error(`Storybook path must be inside the project: ${path}`);
    }

    return absolute;
};

const resolveStorybookConfigPath = (root: string, configured?: string): string | undefined => {
    if (configured === undefined) {
        return findConfigFile(root, STORYBOOK_CONFIG_BASE, CONFIG_EXTENSIONS);
    }

    const path = projectPath(root, configured);

    if (!CONFIG_EXTENSIONS.includes(extname(path))) {
        throw new Error(`Storybook configuration must use an ESM JavaScript or TypeScript file: ${path}`);
    }

    if (!isFile(path)) {
        throw new Error(`Storybook configuration does not exist: ${path}`);
    }

    return path;
};

const patterns = (value: unknown, name: string): string[] => {
    if (!Array.isArray(value)) {
        throw new TypeError(`Storybook ${name} must be an array`);
    }

    return value.map((pattern: unknown) => {
        if (
            typeof pattern !== "string" ||
            pattern.trim().length === 0 ||
            isAbsolute(pattern) ||
            pattern.split(/[\\/]/).includes("..") ||
            pattern.startsWith("!")
        ) {
            throw new TypeError(`Storybook ${name} must contain project-relative glob patterns`);
        }

        return pattern;
    });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const previewOption = (value: unknown): string | undefined => {
    if (value !== undefined && (typeof value !== "string" || value.trim().length === 0 || isAbsolute(value))) {
        throw new TypeError("Storybook preview must be a project-relative path");
    }

    return value;
};

const parseStorybookConfig = (value: unknown): StorybookConfig => {
    if (!isRecord(value)) {
        throw new TypeError("Storybook configuration must export an object");
    }

    const stories = "stories" in value ? patterns(value.stories, "stories") : DEFAULT_STORIES;
    const exclude = "exclude" in value ? patterns(value.exclude, "exclude") : [];
    const preview = previewOption(value.preview);

    return { stories, exclude, preview };
};

const autoTitle = (root: string, path: string): string =>
    relative(root, path)
        .split(sep)
        .join("/")
        .replace(/^src\//, "")
        .replace(/\.stories\.(?:[jt]sx?|m[jt]s)$/, "");

const discoverStorybookFiles = (
    root: string,
    configPath: string | undefined,
    config: StorybookConfig,
): StorybookFiles => {
    const previewPath =
        config.preview === undefined
            ? findConfigFile(root, STORYBOOK_PREVIEW_BASE, PREVIEW_EXTENSIONS)
            : projectPath(root, config.preview);

    if (previewPath !== undefined && !isFile(previewPath)) {
        throw new Error(`Storybook preview does not exist: ${previewPath}`);
    }

    const paths = globSync(config.stories, {
        cwd: root,
        exclude: [...DEFAULT_EXCLUDES, ...config.exclude],
        withFileTypes: true,
    })
        .filter((entry) => entry.isFile())
        .map((entry) => projectPath(root, resolve(entry.parentPath, entry.name)));
    const matched = sortStringsBy([...new Set(paths)], (path) => path);
    const stories = matched.filter((path) => !isMdx(path)).map((id) => ({ id, title: autoTitle(root, id) }));
    const skippedMdx = matched.filter(isMdx);

    return { configPath, previewPath, stories, skippedMdx };
};

const prepareStorybookFiles = async (root: string, configured?: string): Promise<StorybookFiles> => {
    const configPath = resolveStorybookConfigPath(root, configured);
    const value = configPath === undefined ? {} : await loadConfigModule(configPath);

    return discoverStorybookFiles(root, configPath, parseStorybookConfig(value));
};

const isStorybookConfigCandidate = (root: string, path: string): boolean =>
    CONFIG_EXTENSIONS.some((extension) => path === resolve(root, `${STORYBOOK_CONFIG_BASE}${extension}`)) ||
    PREVIEW_EXTENSIONS.some((extension) => path === resolve(root, `${STORYBOOK_PREVIEW_BASE}${extension}`));

export {
    discoverStorybookFiles,
    isStorybookConfigCandidate,
    parseStorybookConfig,
    prepareStorybookFiles,
    resolveStorybookConfigPath,
    type StorybookFiles,
};
