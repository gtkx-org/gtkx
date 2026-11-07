import { useEffect, useState } from "react";
import type { Note } from "../notes/note.js";
import { SearchIndex } from "./search-index.js";

const useNoteSearch = (
    notes: ReadonlyMap<string, Note> | null,
    query: string,
): ReadonlySet<string> | null => {
    const [index] = useState(() => new SearchIndex());
    const [result, setResult] = useState<ReadonlySet<string> | null>(null);

    useEffect(() => () => index.close(), [index]);

    useEffect(() => {
        if (notes === null) {
            return;
        }
        index.update(notes.values());
        if (query === "") {
            return;
        }
        let current = true;
        void index.search(query).then((names) => {
            if (current) {
                setResult(new Set(names));
            }
        });

        return () => {
            current = false;
        };
    }, [index, notes, query]);

    return query === "" ? null : result;
};

export { useNoteSearch };
