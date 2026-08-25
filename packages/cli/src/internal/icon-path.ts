import { type Stats, statSync } from "node:fs";
import { basename, extname, isAbsolute, relative, resolve } from "node:path";

type ResolvedIconSource = {
    iconsDir: string | null;
    iconFile: string | null;
};

const ICON_EXTENSIONS: Set<string> = new Set([".svg", ".png", ".xpm"]);
const SCALABLE_DIR = "hicolor/scalable/apps";
const SIZE_PATTERN = /^(?<width>[1-9]\d{0,3})x(?<height>[1-9]\d{0,3})$/;
const SIZE_SEPARATORS = /[-_.]/;

const isInside = (parent: string, candidate: string): boolean => {
    const rel = relative(parent, candidate);

    return rel.length > 0 && !rel.startsWith("..") && !isAbsolute(rel);
};

const getStats = (path: string): Stats | undefined => {
    try {
        return statSync(path, { throwIfNoEntry: false });
    } catch {
        return undefined;
    }
};

const iconExtension = (file: string): string => {
    const extension = extname(file).toLowerCase();

    if (!ICON_EXTENSIONS.has(extension)) {
        throw new Error(`Cannot use ${file} as an application icon: expected an SVG, PNG, or XPM file`);
    }

    return extension;
};

const resolveIconSource = (root: string, configured: string | undefined): ResolvedIconSource => {
    if (configured === undefined) {
        return { iconsDir: null, iconFile: null };
    }

    const path = resolve(root, configured);

    if (!isInside(root, path)) {
        throw new Error(`Cannot use "${configured}" as the icon path: it is outside ${root}`);
    }

    const stats = getStats(path);

    if (stats?.isDirectory() === true) {
        return { iconsDir: path, iconFile: null };
    }

    if (stats?.isFile() !== true) {
        throw new Error(`Cannot read the icon path "${configured}": no such file or directory under ${root}`);
    }

    iconExtension(path);

    return { iconsDir: null, iconFile: path };
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

export { relativeIconPath, resolveIconSource, type ResolvedIconSource };
