import { watch } from "node:fs";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { createNote, type Note, noteName, readNote, readNotes, renameNote, trashNote } from "./files.js";
import { NoteSaver } from "./note-saver.js";

type NoteMap = ReadonlyMap<string, Note>;

type NotesValue = {
    folder: string;
    notes: NoteMap | null;
    create: (name: string, text: string) => Promise<string>;
    edit: (name: string, text: string) => void;
    rename: (from: string, to: string) => Promise<void>;
    trash: (name: string) => Promise<void>;
};

const NotesContext = createContext<NotesValue | null>(null);

const withNote = (notes: NoteMap | null, name: string, note: Note | null): NoteMap => {
    const next = new Map(notes);
    if (note === null) {
        next.delete(name);
    } else {
        next.set(name, note);
    }

    return next;
};

const NotesProvider = ({ folder, children }: { folder: string; children: ReactNode }) => {
    const [notes, setNotes] = useState<NoteMap | null>(null);
    const [saver] = useState(() => new NoteSaver(folder));

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;

        const refresh = async (name: string): Promise<void> => {
            const note = await readNote(folder, name);
            const isOwnWrite = note !== null && saver.isOwnWrite(name, note.text);
            if (signal.aborted || saver.isPending(name) || isOwnWrite) {
                return;
            }
            setNotes((current) => withNote(current, name, note));
        };

        const load = async (): Promise<void> => {
            const list = await readNotes(folder);
            watch(folder, { signal }, (_event, fileName) => {
                const name = fileName === null ? null : noteName(fileName);
                if (name !== null) {
                    void refresh(name);
                }
            });
            if (!signal.aborted) {
                setNotes(new Map(list.map((note) => [note.name, note])));
            }
        };

        void load();

        return () => {
            controller.abort();
            saver.flushAll();
        };
    }, [folder, saver]);

    const create = async (base: string, text: string): Promise<string> => {
        const name = await createNote(folder, base, text);
        saver.remember(name, text);
        setNotes((current) => withNote(current, name, { name, text, modified: Date.now() }));

        return name;
    };

    const edit = (name: string, text: string): void => {
        saver.schedule(name, text);
        setNotes((current) => withNote(current, name, { name, text, modified: Date.now() }));
    };

    const rename = async (from: string, to: string): Promise<void> => {
        await saver.settle(from);
        await renameNote(folder, from, to);
        saver.forget(from);
        setNotes((current) => {
            const note = current?.get(from);
            const next = withNote(current, from, null);

            return note === undefined ? next : withNote(next, to, { ...note, name: to });
        });
    };

    const trash = async (name: string): Promise<void> => {
        await saver.settle(name);
        await trashNote(folder, name);
        saver.forget(name);
        setNotes((current) => withNote(current, name, null));
    };

    return <NotesContext value={{ folder, notes, create, edit, rename, trash }}>{children}</NotesContext>;
};

const useNotes = (): NotesValue => {
    const value = use(NotesContext);
    if (value === null) {
        throw new Error("NotesProvider is required");
    }

    return value;
};

export { NotesProvider, useNotes };
