import { Worker } from "node:worker_threads";
import type { SearchRequest, SearchResponse } from "./search-worker.js";

type SearchableNote = { name: string; text: string };

class SearchIndex {
    readonly #indexed = new Map<string, string>();
    readonly #waiting = new Map<number, (names: string[]) => void>();
    #worker: Worker | null = null;
    #nextId = 0;

    update(notes: Iterable<SearchableNote>): void {
        const current = new Map(
            [...notes].map((note) => [note.name, note.text]),
        );
        const changed = [...current]
            .filter(([name, text]) => this.#indexed.get(name) !== text)
            .map(([name, text]) => ({ name, text }));
        const removed = [...this.#indexed.keys()].filter(
            (name) => !current.has(name),
        );
        if (changed.length === 0 && removed.length === 0) {
            return;
        }
        this.#indexed.clear();
        for (const [name, text] of current) {
            this.#indexed.set(name, text);
        }
        this.#post({ type: "update", notes: changed, removed });
    }

    search(query: string): Promise<string[]> {
        const id = this.#nextId++;
        const result = new Promise<string[]>((resolve) =>
            this.#waiting.set(id, resolve),
        );
        this.#post({ type: "search", id, query });

        return result;
    }

    close(): void {
        void this.#worker?.terminate();
        this.#worker = null;
        this.#indexed.clear();
        this.#waiting.clear();
    }

    #post(request: SearchRequest): void {
        this.#worker ??= this.#start();
        this.#worker.postMessage(request);
    }

    #start(): Worker {
        const worker = new Worker(
            new URL("./search-worker.ts", import.meta.url),
        );
        worker.on("message", ({ id, names }: SearchResponse) => {
            this.#waiting.get(id)?.(names);
            this.#waiting.delete(id);
        });

        return worker;
    }
}

export { SearchIndex };
