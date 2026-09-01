import { isPathInside } from "@gtkx/utils";
import { statSync } from "node:fs";
import { basename, extname, isAbsolute, join, resolve } from "node:path";

type ResolvedApplicationIcon = { kind: "file"; path: string } |
    { kind: "none" } |
    { kind: "theme"; path: string };

const ICON_EXTENSIONS: Set<string> = new Set([".svg", ".png", ".xpm"]);
const SCALABLE_DIR = "hicolor/scalable/apps";
const SIZE_PATTERN = /^(?<width>[1-9]\d{0,3})x(?<height>[1-9]\d{0,3})$/;
const SIZE_SEPARATORS = /[-_.]/;

const iconExtension = (file: string): string => {
    const extension = extname(file).toLowerCase();

    if (!ICON_EXTENSIONS.has(extension)) {
        throw new Error(`Cannot use ${file} as an application icon: expected an SVG, PNG, or XPM file`);
    }

    return extension;
};

const defaultIconFiles = (root: string, applicationId: string): string[] =>
    [...ICON_EXTENSIONS]
        .map((extension) => join(root, `${applicationId}${extension}`))
        .filter((path) => statSync(path, { throwIfNoEntry: false })?.isFile() === true);

const resolveDefaultApplicationIcon = (root: string, applicationId: string): ResolvedApplicationIcon => {
    const files = defaultIconFiles(root, applicationId);

    if (files.length === 0) {
        return { kind: "none" };
    }

    if (files.length > 1) {
        throw new Error(
            `Found multiple default application icons for ${applicationId}; set \`applicationIcon\` to choose one`,
        );
    }

    const path = files[0];

    if (path === undefined) {
        return { kind: "none" };
    }

    return { kind: "file", path };
};

const resolveApplicationIcon = (
    root: string,
    applicationId: string,
    configured: string | undefined,
): ResolvedApplicationIcon => {
    if (configured === undefined) {
        return resolveDefaultApplicationIcon(root, applicationId);
    }

    if (isAbsolute(configured)) {
        throw new Error(`Cannot use "${configured}" as the application icon: expected a project-relative path`);
    }

    const path = resolve(root, configured);

    if (!isPathInside(root, path)) {
        throw new Error(`Cannot use "${configured}" as the application icon: it is outside ${root}`);
    }

    const stats = statSync(path, { throwIfNoEntry: false });

    if (stats?.isDirectory() === true) {
        return { kind: "theme", path };
    }

    if (stats?.isFile() !== true) {
        throw new Error(`Cannot read the application icon "${configured}": no such file or directory under ${root}`);
    }

    iconExtension(path);

    return { kind: "file", path };
};

const squareSize = (token: string): number | null => {
    const groups = SIZE_PATTERN.exec(token)?.groups;

    if (groups === undefined || groups.width !== groups.height) {
        return null;
    }

    return Number(groups.width);
};

const iconThemeDir = (file: string, extension: string): string => {
    if (extension === ".svg") {
        return SCALABLE_DIR;
    }

    const size = basename(file)
        .split(SIZE_SEPARATORS)
        .map((token) => squareSize(token))
        .find((value) => value !== null);

    return size === undefined ? SCALABLE_DIR : `hicolor/${String(size)}x${String(size)}/apps`;
};

const relativeIconPath = (applicationId: string, file: string): string => {
    const extension = iconExtension(file);

    return `${iconThemeDir(file, extension)}/${applicationId}${extension}`;
};

export { relativeIconPath, resolveApplicationIcon, type ResolvedApplicationIcon };
