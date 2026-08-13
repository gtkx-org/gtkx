type Registration = {
    listener: (...args: unknown[]) => void;
    isOnce: boolean;
};

class FakeEmitter {
    #listeners: Map<string, Registration[]> = new Map();

    #register(event: string, listener: (...args: unknown[]) => void, isOnce: boolean): void {
        const entries = this.#listeners.get(event) ?? [];
        entries.push({ listener, isOnce });
        this.#listeners.set(event, entries);
    }

    on(event: string, listener: (...args: unknown[]) => void): void {
        this.#register(event, listener, false);
    }

    once(event: string, listener: (...args: unknown[]) => void): void {
        this.#register(event, listener, true);
    }

    emit(event: string, ...args: unknown[]): void {
        const entries = this.#listeners.get(event) ?? [];
        this.#listeners.set(event, entries.filter((entry) => !entry.isOnce));

        for (const entry of entries) {
            entry.listener(...args);
        }
    }
}

export { FakeEmitter };
