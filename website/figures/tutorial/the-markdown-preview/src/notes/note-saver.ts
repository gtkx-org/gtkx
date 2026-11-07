import { writeNote } from "./files.js";

const SAVE_DELAY_MS = 400;

type PendingSave = { text: string; timer: NodeJS.Timeout };

class NoteSaver {
    readonly #folder: string;
    readonly #onError: (name: string, error: unknown) => void;
    readonly #failing = new Set<string>();
    readonly #pending = new Map<string, PendingSave>();
    readonly #written = new Map<string, string>();
    readonly #writes = new Map<string, Promise<void>>();

    constructor(
        folder: string,
        onError: (name: string, error: unknown) => void,
    ) {
        this.#folder = folder;
        this.#onError = onError;
    }

    schedule(name: string, text: string): void {
        clearTimeout(this.#pending.get(name)?.timer);
        this.#pending.set(name, {
            text,
            timer: setTimeout(() => this.#flush(name), SAVE_DELAY_MS),
        });
    }

    flushAll(): void {
        for (const name of [...this.#pending.keys()]) {
            this.#flush(name);
        }
    }

    isPending(name: string): boolean {
        return this.#pending.has(name);
    }

    isOwnWrite(name: string, text: string): boolean {
        return this.#written.get(name) === text;
    }

    #flush(name: string): void {
        const entry = this.#pending.get(name);
        if (entry === undefined) {
            return;
        }
        clearTimeout(entry.timer);
        this.#pending.delete(name);
        this.#written.set(name, entry.text);
        const previous = this.#writes.get(name) ?? Promise.resolve();
        const write = previous.then(() => this.#write(name, entry.text));
        this.#writes.set(name, write);
    }

    async #write(name: string, text: string): Promise<void> {
        try {
            await writeNote(this.#folder, name, text);
            this.#failing.delete(name);
        } catch (error) {
            this.#written.delete(name);
            if (!this.#failing.has(name)) {
                this.#failing.add(name);
                this.#onError(name, error);
            }
        }
    }
}

export { NoteSaver };
