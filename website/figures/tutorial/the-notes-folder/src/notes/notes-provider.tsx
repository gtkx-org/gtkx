import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { readNotes } from "./files.js";
import type { Note } from "./note.js";

type NoteMap = ReadonlyMap<string, Note>;

type NotesValue = {
    folder: string;
    notes: NoteMap | null;
};

const NotesContext = createContext<NotesValue | null>(null);

const NotesProvider = ({
    folder,
    children,
}: {
    folder: string;
    children: ReactNode;
}) => {
    const [notes, setNotes] = useState<NoteMap | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const load = async (): Promise<void> => {
            const list = await readNotes(folder);
            if (!controller.signal.aborted) {
                setNotes(new Map(list.map((note) => [note.name, note])));
            }
        };

        void load();

        return () => controller.abort();
    }, [folder]);

    return <NotesContext value={{ folder, notes }}>{children}</NotesContext>;
};

const useNotes = (): NotesValue => {
    const value = use(NotesContext);
    if (value === null) {
        throw new Error("NotesProvider is required");
    }

    return value;
};

export { NotesProvider, useNotes };
