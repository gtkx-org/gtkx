import { watch } from "node:fs";
import { createContext, type ReactNode, use, useEffect, useRef, useState } from "react";
import { type Note, noteName, readNote, readNotes, writeNote } from "./files.js";

type NoteMap = ReadonlyMap<string, Note>;

type NotesValue = {
    folder: string;
    notes: NoteMap | null;
    create: (name: string, text: string) => Promise<void>;
    edit: (name: string, text: string) => void;
};

type PendingSave = { text: string; timer: NodeJS.Timeout };

const SAVE_DELAY_MS = 400;

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
    const pending = useRef(new Map<string, PendingSave>());
    const written = useRef(new Map<string, string>());
    const writes = useRef(new Map<string, Promise<void>>());

    const save = (name: string, text: string): Promise<void> => {
        written.current.set(name, text);
        const write = (writes.current.get(name) ?? Promise.resolve()).then(() => writeNote(folder, name, text));
        writes.current.set(name, write);

        return write;
    };

    const flush = (name: string): void => {
        const entry = pending.current.get(name);
        if (entry === undefined) {
            return;
        }
        clearTimeout(entry.timer);
        pending.current.delete(name);
        void save(name, entry.text);
    };

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;

        const refresh = async (name: string): Promise<void> => {
            const note = await readNote(folder, name);
            const isOwnWrite = note !== null && note.text === written.current.get(name);
            if (signal.aborted || pending.current.has(name) || isOwnWrite) {
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
            for (const name of [...pending.current.keys()]) {
                flush(name);
            }
        };
    }, [folder]);

    const create = async (name: string, text: string): Promise<void> => {
        await save(name, text);
        setNotes((current) => withNote(current, name, { name, text, modified: Date.now() }));
    };

    const edit = (name: string, text: string): void => {
        clearTimeout(pending.current.get(name)?.timer);
        pending.current.set(name, { text, timer: setTimeout(() => flush(name), SAVE_DELAY_MS) });
        setNotes((current) => withNote(current, name, { name, text, modified: Date.now() }));
    };

    return <NotesContext value={{ folder, notes, create, edit }}>{children}</NotesContext>;
};

const useNotes = (): NotesValue => {
    const value = use(NotesContext);
    if (value === null) {
        throw new Error("NotesProvider is required");
    }

    return value;
};

export { NotesProvider, useNotes };
