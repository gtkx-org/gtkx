import { isPathInside, sortStringsBy } from "@gtkx/utils";
import { createJiti } from "jiti";
import { globSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

type StorybookConfig = {
    stories: string[];
    exclude: string[];
    preview: string | undefined;
};

type StorybookFiles = {
    configPath: string | undefined;
    previewPath: string | undefined;
    stories: { id: string; title: string }[];
};

const STORYBOOK_CONFIG_BASE = ".storybook/main";
const STORYBOOK_PREVIEW_BASE = ".storybook/preview";
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"];
const DEFAULT_STORIES = ["src/**/*.stories.{ts,tsx,js,jsx,mts,mjs}"];
const DEFAULT_EXCLUDES = ["**/node_modules/**", "**/.git/**", "**/.gtkx/**", "**/dist/**", "**/build/**"];

const isFile = (path: string): boolean => statSync(path, { throwIfNoEntry: false })?.isFile() === true;

const findConfigFile = (root: string, base: string): string | undefined =>
    EXTENSIONS.map((extension) => resolve(root, `${base}${extension}`)).find((path) => isFile(path));

const projectPath = (root: string, path: string): string => {
    const absolute = resolve(root, path);

    if (!isPathInside(root, absolute)) {
        throw new Error(`Storybook path must be inside the project: ${path}`);
    }

    return absolute;
};

const resolveStorybookConfigPath = (root: string, configured?: string): string | undefined => {
    if (configured === undefined) {
        return findConfigFile(root, STORYBOOK_CONFIG_BASE);
    }

    const path = projectPath(root, configured);

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
            typeof pattern !== "string" || pattern.trim().length === 0 || isAbsolute(pattern) ||
            pattern.split(/[\\/]/).includes("..") || pattern.startsWith("!")
        ) {
            throw new TypeError(`Storybook ${name} must contain project-relative glob patterns`);
        }

        return pattern;
    });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const previewOption = (value: unknown): string | undefined => {
    if (value !== undefined && (typeof value !== "string" || value.trim().length === 0)) {
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
    relative(root, path).split(sep).join("/").replace(/^src\//, "").replace(/\.stories\.[cm]?[jt]sx?$/, "");

const discoverStorybookFiles = (
    root: string,
    configPath: string | undefined,
    config: StorybookConfig,
): StorybookFiles => {
    const previewPath = config.preview === undefined
        ? findConfigFile(root, STORYBOOK_PREVIEW_BASE)
        : projectPath(root, config.preview);

    if (previewPath !== undefined && !isFile(previewPath)) {
        throw new Error(`Storybook preview does not exist: ${previewPath}`);
    }

    const paths = globSync(config.stories, {
        cwd: root,
        exclude: [...DEFAULT_EXCLUDES, ...config.exclude],
        withFileTypes: true,
    }).filter((entry) => entry.isFile()).map((entry) => projectPath(root, resolve(entry.parentPath, entry.name)));
    const stories = sortStringsBy([...new Set(paths)], (path) => path)
        .map((id) => ({ id, title: autoTitle(root, id) }));

    return { configPath, previewPath, stories };
};

const prepareStorybookFiles = async (root: string, configured?: string): Promise<StorybookFiles> => {
    const configPath = resolveStorybookConfigPath(root, configured);
    const jiti = createJiti(resolve(root, "package.json"), { moduleCache: false, fsCache: false });
    const value = configPath === undefined ? {} : await jiti.import(configPath, { default: true });

    return discoverStorybookFiles(root, configPath, parseStorybookConfig(value));
};

const isStorybookConfigCandidate = (root: string, path: string): boolean =>
    EXTENSIONS.some((extension) =>
        path === resolve(root, `${STORYBOOK_CONFIG_BASE}${extension}`) ||
        path === resolve(root, `${STORYBOOK_PREVIEW_BASE}${extension}`),
    );

export {
    discoverStorybookFiles,
    isStorybookConfigCandidate,
    parseStorybookConfig,
    prepareStorybookFiles,
    resolveStorybookConfigPath,
    type StorybookFiles,
};
