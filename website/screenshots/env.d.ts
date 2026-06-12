interface ImportMeta {
    /** Vite's eager glob import, as used by the gallery capture suite. */
    glob<T>(pattern: string, options: { eager: true }): Record<string, T>;
}
