import { sortStrings } from "@gtkx/utils";
import { posix } from "node:path";
import type { StagedFile } from "../types.js";

type NfpmContent = {
    src?: string;
    dst: string;
    type?: string;
    file_info?: { mode: number };
};

const FILESYSTEM_OWNED_PREFIXES = new Set([
    "/usr",
    "/usr/bin",
    "/usr/lib",
    "/usr/share",
    "/usr/share/applications",
    "/usr/share/dbus-1",
    "/usr/share/dbus-1/services",
    "/usr/share/doc",
    "/usr/share/glib-2.0",
    "/usr/share/glib-2.0/schemas",
    "/usr/share/icons",
    "/usr/share/licenses",
    "/usr/share/metainfo",
    "/usr/share/mime",
    "/usr/share/mime/packages",
]);

const ICON_THEME_PREFIX = "/usr/share/icons/";

const contentFor = (prefix: string, file: StagedFile): NfpmContent => ({
    src: file.abs,
    dst: posix.join(prefix, file.rel),
    file_info: { mode: file.mode },
});

const isFilesystemOwned = (directory: string): boolean =>
    FILESYSTEM_OWNED_PREFIXES.has(directory) || directory.startsWith(ICON_THEME_PREFIX);

const parentDirectories = (destination: string): string[] => {
    const parts = destination.split("/").slice(1, -1);

    return parts.map((_, index) => `/${parts.slice(0, index + 1).join("/")}`);
};

const ownedDirectories = (contents: NfpmContent[]): string[] => {
    const directories = new Set(contents.flatMap((entry) => parentDirectories(entry.dst)));

    return sortStrings([...directories].filter((directory) => !isFilesystemOwned(directory)));
};

const directoryContent = (destination: string): NfpmContent => ({
    dst: destination,
    type: "dir",
    file_info: { mode: 0o755 },
});

const nfpmContents = (prefix: string, files: StagedFile[], shouldOwnDirectories: boolean): NfpmContent[] => {
    const contents = files.map((file) => contentFor(prefix, file));

    if (!shouldOwnDirectories) {
        return contents;
    }

    return [...ownedDirectories(contents).map((directory) => directoryContent(directory)), ...contents];
};

export { nfpmContents };
