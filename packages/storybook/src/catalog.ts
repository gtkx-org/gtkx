import type { Args, ArgTypes, ComponentMeta, ComposedStory, Preview, StoryAnnotations } from "./types.js";
import { composeStories } from "./compose.js";
import { storyNameFromExport } from "./upstream.js";

/** A lazily loaded CSF module discovered in a Storybook project. */
type StorySource = {
    /** Stable module identifier used for caching and error reporting. */
    id: string;
    /** Fallback story group title when the module does not declare one. */
    title: string;
    /** Imports the module and resolves to its CSF exports. */
    load: () => Promise<unknown>;
};

/** A composed story and the metadata used to display it in the explorer. */
type StoryEntry = {
    /** Storybook identifier used to preserve the selected story across updates. */
    id: string;
    /** Component group title declared by the module or derived from its source. */
    title: string;
    /** Display name declared by the story or derived from its export name. */
    name: string;
    /** Name of the CSF export that defines this story. */
    exportName: string;
    /** Identifier of the module containing this story. */
    source: string;
    /** Renderable story with its metadata, decorators, and default args composed. */
    story: ComposedStory;
    /** Resolved arg types with explicitly configured explorer controls. */
    controls: ArgTypes;
};

/** A source loading or composition failure displayed alongside healthy stories. */
type StoryLoadError = {
    /** Identifier of the failed source, or Storybook for a session failure. */
    source: string;
    /** Normalized error raised while loading or composing the source. */
    error: Error;
};

/** Current explorer contents and loading state exposed to subscribers. */
type StoryCatalogSnapshot = {
    /** Successfully composed stories with duplicate identifiers excluded. */
    stories: StoryEntry[];
    /** Failures encountered during the latest load or reported by the session. */
    errors: StoryLoadError[];
    /** Whether the catalog is waiting for the latest source load to finish. */
    isLoading: boolean;
};

type CachedStories = {
    module: unknown;
    title: string;
    preview: Preview;
    entries: StoryEntry[];
};

type LoadedSource = StoryLoadError | { source: StorySource; cached: CachedStories };

const EMPTY_PREVIEW: Preview = {};

const normalizeError = (cause: unknown): Error => cause instanceof Error ? cause : new Error(String(cause));

const isObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const explicitControls = (
    resolved: ArgTypes,
    story: StoryAnnotations<Args> | undefined,
    meta: ComponentMeta<Args>,
    preview: Preview,
): ArgTypes => {
    const controls: ArgTypes = {};

    for (const [argument, annotation] of Object.entries(resolved)) {
        const control = story?.argTypes?.[argument]?.control ??
            meta.argTypes?.[argument]?.control ?? preview.argTypes?.[argument]?.control;

        if (control === undefined) {
            continue;
        }

        controls[argument] = { ...annotation, control: control === false ? false : annotation?.control ?? control };
    }

    return controls;
};

const displayName = (story: StoryAnnotations<Args> | undefined, exportName: string): string => {
    const name = story?.name;

    if (name === undefined) {
        return storyNameFromExport(exportName);
    }

    if (typeof name !== "string") {
        throw new TypeError("Expected a story display name");
    }

    return name;
};

const composeSource = (source: StorySource, module: unknown, preview: Preview): StoryEntry[] => {
    if (!isObject(module) || !isObject(module.default)) {
        throw new TypeError(`Expected CSF3 component metadata in ${source.id}`);
    }

    const title = module.default.title ?? source.title;

    if (typeof title !== "string" || title.trim().length === 0) {
        throw new TypeError(`Expected a story title in ${source.id}`);
    }

    const annotations = {
        ...module,
        default: { ...module.default, title },
    } as Record<string, StoryAnnotations<Args>> & { default: ComponentMeta<Args> };
    const stories = composeStories(annotations, preview);

    return Object.entries(stories).map(([exportName, story]) => ({
        id: story.id,
        title,
        name: displayName(annotations[exportName], exportName),
        exportName,
        source: source.id,
        story,
        controls: explicitControls(story.argTypes, annotations[exportName], annotations.default, preview),
    }));
};

const withoutDuplicateIds = (entries: StoryEntry[], errors: StoryLoadError[]): StoryEntry[] => {
    const counts: Map<string, number> = new Map();

    for (const entry of entries) {
        counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
    }

    return entries.filter((entry) => {
        if (counts.get(entry.id) === 1) {
            return true;
        }

        errors.push({ source: entry.source, error: new Error(`Duplicate story ID: ${entry.id}`) });

        return false;
    });
};

const collectSources = (loaded: LoadedSource[]) => {
    const cache: Map<string, CachedStories> = new Map();
    const entries: StoryEntry[] = [];
    const errors: StoryLoadError[] = [];

    for (const result of loaded) {
        if ("error" in result) {
            errors.push(result);
        } else {
            cache.set(result.source.id, result.cached);
            entries.push(...result.cached.entries);
        }
    }

    return { cache, stories: withoutDuplicateIds(entries, errors), errors };
};

const createSourceCache = (): Map<string, CachedStories> => new Map();

const loadSource = async (
    source: StorySource,
    preview: Preview,
    getCache: () => Map<string, CachedStories>,
): Promise<LoadedSource> => {
    try {
        const module = await source.load();
        const previous = getCache().get(source.id);
        const cached = previous !== undefined && previous.module === module &&
            previous.title === source.title && previous.preview === preview
            ? previous
            : { module, title: source.title, preview, entries: composeSource(source, module, preview) };

        return { source, cached };
    } catch (error) {
        return { source: source.id, error: normalizeError(error) };
    }
};

/** Loads CSF modules and publishes subscribable explorer snapshots. */
class StoryCatalog {
    private snapshot: StoryCatalogSnapshot = { stories: [], errors: [], isLoading: false };
    private readonly listeners: Set<() => void> = new Set();
    private cache = createSourceCache();
    private revision = 0;

    /** Returns the current snapshot, retaining its identity until the next update. */
    getSnapshot = (): StoryCatalogSnapshot => this.snapshot;

    /** Registers a snapshot listener and returns a function that unsubscribes it. */
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    };

    private publish(snapshot: StoryCatalogSnapshot): void {
        this.snapshot = snapshot;

        for (const listener of this.listeners) {
            listener();
        }
    }

    /**
     * Replaces the catalog with stories composed from the supplied sources and preview.
     * Only the latest load publishes results; unchanged module identities reuse composed stories.
     * Rejects with an AggregateError after publishing healthy stories when any source fails.
     */
    async load(sources: StorySource[], preview: Preview = EMPTY_PREVIEW): Promise<void> {
        const revision = ++this.revision;
        this.publish({ ...this.snapshot, isLoading: true });
        const loaded = await Promise.all(sources.map((source) => loadSource(source, preview, () => this.cache)));

        if (revision !== this.revision) {
            return;
        }

        const { cache, stories, errors } = collectSources(loaded);
        this.cache = cache;
        this.publish({ stories, errors, isLoading: false });

        if (errors.length > 0) {
            throw new AggregateError(errors.map(({ error }) => error), "Some stories could not be loaded");
        }
    }

    /** Publishes a session failure while preserving stories and superseding pending loads. */
    reportError(cause: unknown): void {
        this.revision++;
        this.publish({
            ...this.snapshot,
            isLoading: false,
            errors: [...this.snapshot.errors, { source: "Storybook", error: normalizeError(cause) }],
        });
    }
}

export { StoryCatalog };
export type { StoryCatalogSnapshot, StoryEntry, StoryLoadError, StorySource };
