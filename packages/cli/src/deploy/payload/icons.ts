import { join } from "node:path";
import type { DeploySettings, StagedFile } from "../types.js";
import { relativeIconPath } from "../../internal/icon-path.js";
import { listFilesRecursive } from "../../internal/list-files.js";
import { copyInto } from "./copy-tree.js";

type ApplicationIconVariant = {
    effectivePixels: number;
    scalable: boolean;
};

const ICON_EXTENSIONS = [".svg", ".png", ".xpm"];
const SHARE_ICONS = "share/icons";
const SIZE_PATTERN = /^(?<width>[1-9]\d{0,3})x(?<height>[1-9]\d{0,3})(?:@(?<scale>[1-9]\d*))?$/;

const getSquareSize = (token: string): { pixels: number; scale: number } | null => {
    const groups = SIZE_PATTERN.exec(token)?.groups;

    if (groups === undefined || groups.width !== groups.height) {
        return null;
    }

    const pixels = Number(groups.width);
    const scale = Number(groups.scale ?? "1");

    return Number.isSafeInteger(pixels * scale) ? { pixels, scale } : null;
};

const isIconThemeSize = (segment: string | undefined): boolean =>
    segment === "scalable" || segment === "symbolic" ||
    (segment !== undefined && getSquareSize(segment) !== null);

const iconExtension = (applicationId: string, filename: string | undefined): string | undefined =>
    ICON_EXTENSIONS.find((candidate) => filename === `${applicationId}${candidate}`);

const isApplicationIconLayout = (segments: (string | undefined)[]): boolean => {
    const [share, icons, theme, size, context] = segments;

    return share === "share" &&
        icons === "icons" &&
        theme === "hicolor" &&
        context === "apps" &&
        isIconThemeSize(size);
};

const classifyApplicationIcon = (applicationId: string, rel: string): ApplicationIconVariant | null => {
    const segments = rel.split(/[\\/]/);

    if (segments.length !== 6) {
        return null;
    }

    const size = segments[3];
    const filename = segments[5];
    const extension = iconExtension(applicationId, filename);

    if (extension === undefined || !isApplicationIconLayout(segments)) {
        return null;
    }

    const square = size === undefined ? null : getSquareSize(size);

    return {
        effectivePixels: square === null ? 0 : square.pixels * square.scale,
        scalable: extension === ".svg",
    };
};

const isApplicationIcon = (settings: DeploySettings, rel: string): boolean =>
    classifyApplicationIcon(settings.applicationId, rel) !== null;

const stageIconTree = (root: string, themePath: string): StagedFile[] =>
    listFilesRecursive(themePath).map((file) => copyInto(root, join(SHARE_ICONS, file.rel), file.absPath));

const iconPathFor = (settings: DeploySettings, iconPath: string): string =>
    relativeIconPath(settings.applicationId, iconPath);

const stageIconFile = (settings: DeploySettings, root: string, iconPath: string): StagedFile[] =>
    [copyInto(root, join(SHARE_ICONS, iconPathFor(settings, iconPath)), iconPath)];

const assertApplicationIcon = (settings: DeploySettings, staged: StagedFile[]): void => {
    if (staged.some((file) => isApplicationIcon(settings, file.rel))) {
        return;
    }

    throw new Error(
        "Cannot deploy without a usable application icon: the configured theme must contain " +
        `${settings.applicationId}.svg, ${settings.applicationId}.png, or ${settings.applicationId}.xpm ` +
        "under hicolor/<size>/apps. " +
        "The desktop entry names " +
        `"${settings.applicationId}" as its icon, so the file has to match. ` +
        "Set `applicationIcon` to a theme directory containing " +
        `hicolor/scalable/apps/${settings.applicationId}.svg, or point it at a single icon file.`,
    );
};

const stageIcons = (settings: DeploySettings, root: string): StagedFile[] => {
    const source = settings.paths.applicationIcon;

    if (source.kind === "file") {
        return stageIconFile(settings, root, source.path);
    }

    const staged = source.kind === "theme" ? stageIconTree(root, source.path) : [];
    assertApplicationIcon(settings, staged);

    return staged;
};

export { classifyApplicationIcon, iconPathFor, stageIcons, type ApplicationIconVariant };
