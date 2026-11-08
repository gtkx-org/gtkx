import MiniSearch from "minisearch";
import { parentPort } from "node:worker_threads";

type IndexedNote = { name: string; text: string };

type SearchRequest =
    | { type: "update"; notes: IndexedNote[]; removed: string[] }
    | { type: "search"; id: number; query: string };

type SearchResponse = { id: number; names: string[] };

if (parentPort === null) {
    throw new Error("search-worker must run in a worker thread");
}
const port = parentPort;

const index = new MiniSearch<IndexedNote>({
    idField: "name",
    fields: ["name", "text"],
    searchOptions: { prefix: true, fuzzy: 0.2 },
});

port.on("message", (request: SearchRequest) => {
    switch (request.type) {
        case "update":
            for (const name of [...request.removed, ...request.notes.map((note) => note.name)]) {
                if (index.has(name)) {
                    index.discard(name);
                }
            }
            index.addAll(request.notes);
            break;
        case "search": {
            const names = index.search(request.query).map((result) => String(result.id));
            port.postMessage({ id: request.id, names } satisfies SearchResponse);
            break;
        }
    }
});

export type { SearchRequest, SearchResponse };
