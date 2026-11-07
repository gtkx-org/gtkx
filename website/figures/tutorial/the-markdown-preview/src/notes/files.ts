import * as GLib from "@gtkx/gi/glib";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Note, toNote } from "./note.js";

const EXTENSION = ".md";

const defaultFolder = (): string =>
    join(
        GLib.getUserSpecialDir(GLib.UserDirectory.DIRECTORY_DOCUMENTS) ??
            GLib.getHomeDir(),
        "Notes",
    );

const noteName = (fileName: string): string | null =>
    fileName.endsWith(EXTENSION) && !fileName.startsWith(".")
        ? fileName.slice(0, -EXTENSION.length)
        : null;

const linkedNoteName = (uri: string): string | null => {
    const fileName =
        GLib.Uri.peekScheme(uri) === null
            ? GLib.Uri.unescapeString(uri, "/")
            : null;

    return fileName === null || fileName.includes("/")
        ? null
        : noteName(fileName);
};

const notePath = (folder: string, name: string): string =>
    join(folder, `${name}${EXTENSION}`);

const isMissing = (error: unknown): boolean =>
    error instanceof Error && "code" in error && error.code === "ENOENT";

const readNote = async (folder: string, name: string): Promise<Note | null> => {
    const path = notePath(folder, name);
    try {
        const [text, info] = await Promise.all([
            readFile(path, "utf8"),
            stat(path),
        ]);

        return info.isFile() ? toNote(name, text, info.mtimeMs) : null;
    } catch (error) {
        if (isMissing(error)) {
            return null;
        }

        throw error;
    }
};

const readNotes = async (folder: string): Promise<Note[]> => {
    await mkdir(folder, { recursive: true });
    const names = (await readdir(folder))
        .map(noteName)
        .filter((name) => name !== null);
    const notes = await Promise.all(
        names.map((name) => readNote(folder, name)),
    );

    return notes.filter((note) => note !== null);
};

const writeNote = (folder: string, name: string, text: string): Promise<void> =>
    writeFile(notePath(folder, name), text);

export {
    defaultFolder,
    linkedNoteName,
    noteName,
    readNote,
    readNotes,
    writeNote,
};
