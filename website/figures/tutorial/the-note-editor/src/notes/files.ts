import * as GLib from "@gtkx/gi/glib";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
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

const readNote = async (folder: string, name: string): Promise<Note | null> => {
    const path = join(folder, `${name}${EXTENSION}`);
    const [text, info] = await Promise.all([
        readFile(path, "utf8"),
        stat(path),
    ]);

    return info.isFile() ? toNote(name, text, info.mtimeMs) : null;
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

export { defaultFolder, readNotes };
