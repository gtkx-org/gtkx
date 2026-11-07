import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { access, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Note, toNote } from "./note.js";

const EXTENSION = ".md";

const defaultFolder = (): string =>
    join(GLib.getUserSpecialDir(GLib.UserDirectory.DIRECTORY_DOCUMENTS) ?? GLib.getHomeDir(), "Notes");

const noteName = (fileName: string): string | null =>
    fileName.endsWith(EXTENSION) && !fileName.startsWith(".") ? fileName.slice(0, -EXTENSION.length) : null;

const linkedNoteName = (uri: string): string | null => {
    const fileName = GLib.Uri.peekScheme(uri) === null ? GLib.Uri.unescapeString(uri, "/") : null;

    return fileName === null || fileName.includes("/") ? null : noteName(fileName);
};

const notePath = (folder: string, name: string): string => join(folder, `${name}${EXTENSION}`);

const isMissing = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT";

const readNote = async (folder: string, name: string): Promise<Note | null> => {
    const path = notePath(folder, name);
    try {
        const [text, info] = await Promise.all([readFile(path, "utf8"), stat(path)]);

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
    const names = (await readdir(folder)).map(noteName).filter((name) => name !== null);
    const notes = await Promise.all(names.map((name) => readNote(folder, name)));

    return notes.filter((note) => note !== null);
};

const writeNote = (folder: string, name: string, text: string): Promise<void> =>
    writeFile(notePath(folder, name), text);

const exists = async (path: string): Promise<boolean> => {
    try {
        await access(path);

        return true;
    } catch (error) {
        if (isMissing(error)) {
            return false;
        }

        throw error;
    }
};

const renameNote = async (folder: string, from: string, to: string): Promise<void> => {
    const target = notePath(folder, to);
    if (await exists(target)) {
        throw new Error(`${target} already exists`);
    }
    await rename(notePath(folder, from), target);
};

const trashNote = async (folder: string, name: string): Promise<void> => {
    await Gio.File.newForPath(notePath(folder, name)).trashAsync(GLib.PRIORITY_DEFAULT);
};

const isValidName = (name: string): boolean =>
    name.trim() === name && name !== "" && !name.startsWith(".") && !name.includes("/");

const isTaken = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "EEXIST";

const createNote = async (folder: string, base: string, text: string): Promise<string> => {
    for (let number = 1; ; number++) {
        const name = number === 1 ? base : `${base} ${number}`;
        try {
            await writeFile(notePath(folder, name), text, { flag: "wx" });

            return name;
        } catch (error) {
            if (!isTaken(error)) {
                throw error;
            }
        }
    }
};

export {
    createNote,
    defaultFolder,
    isValidName,
    linkedNoteName,
    noteName,
    readNote,
    readNotes,
    renameNote,
    trashNote,
    writeNote,
};
