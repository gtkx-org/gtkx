import type * as Gtk from "@gtkx/gi/gtk";
import * as Adw from "@gtkx/gi/adw";
import type { ExistingTab } from "./tab-view-router.js";
import type { TabViewNavigationOptions } from "./types.js";

/** Page property values last written from a route's options. */
type AppliedOptions = Pick<
    TabViewNavigationOptions,
    | "icon"
    | "indicatorActivatable"
    | "indicatorIcon"
    | "indicatorTooltip"
    | "keyword"
    | "liveThumbnail"
    | "loading"
    | "needsAttention"
    | "thumbnailXalign"
    | "thumbnailYalign"
    | "tooltip"
> & { title?: string };

/** A native page a tab view navigator created or adopted, with the host its content renders into. */
type PageRecord = {
    key: string;
    name: string;
    params: object | undefined;
    page: Adw.TabPage;
    host: Adw.Bin;
    applied: AppliedOptions;
};

/** The pages of one navigator by route key, notifying React when the set changes. */
type PageStore = {
    get: (key: string) => PageRecord | undefined;
    set: (record: PageRecord) => void;
    delete: (key: string) => void;
    keys: () => string[];
    subscribe: (listener: () => void) => () => void;
    getVersion: () => number;
    /** Key of the route whose page was selected by the last sync, so native selection changes are not undone. */
    lastFocus: string | undefined;
};

const records = new WeakMap<Adw.TabPage, PageRecord>();

const recordOf = (page: Adw.TabPage): PageRecord | undefined => records.get(page);

const registerPage = (record: PageRecord): void => {
    records.set(record.page, record);
};

const ownerOf = (page: Adw.TabPage): Adw.TabView | null => {
    let widget: Gtk.Widget | null = page.getChild();

    while (widget !== null) {
        if (widget instanceof Adw.TabView) {
            return widget;
        }

        widget = widget.getParent();
    }

    return null;
};

const readExistingTabs = (view: Adw.TabView): ExistingTab[] => {
    const selected = view.getSelectedPage();
    const tabs: ExistingTab[] = [];

    for (let position = 0; position < view.getNPages(); position += 1) {
        const page = view.getNthPage(position);
        const record = records.get(page);

        if (record === undefined) {
            continue;
        }

        const parent = page.getParent();
        const parentRecord = parent === null ? undefined : records.get(parent);

        tabs.push({
            key: record.key,
            name: record.name,
            params: record.params,
            pinned: page.getPinned(),
            parent: parentRecord?.key,
            selected: page === selected,
        });
    }

    return tabs;
};

const createPageStore = (): PageStore => {
    const byKey = new Map<string, PageRecord>();
    const listeners = new Set<() => void>();
    let version = 0;

    const notify = (): void => {
        version += 1;

        for (const listener of listeners) {
            listener();
        }
    };

    return {
        get: (key) => byKey.get(key),
        set: (record) => {
            byKey.set(record.key, record);
            notify();
        },
        delete: (key) => {
            if (byKey.delete(key)) {
                notify();
            }
        },
        keys: () => [...byKey.keys()],
        subscribe: (listener) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        getVersion: () => version,
        lastFocus: undefined,
    };
};

export { createPageStore, ownerOf, type PageRecord, type PageStore, readExistingTabs, recordOf, registerPage };
