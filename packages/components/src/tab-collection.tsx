import * as Adw from "@gtkx/gi/adw";
import { AdwTabPage } from "@gtkx/jsx/adw";
import { createRoot, flushSync, type Root } from "@gtkx/react";
import { getClassType } from "@gtkx/runtime";
import { createRef, type RefObject, useEffect } from "react";
import type { TabCollection, TabCollectionOptions } from "./types.js";

type TabHandle<T> = {
    root: Root;
    page: RefObject<Adw.TabPage | null>;
    getPage: () => Adw.TabPage | null;
    parent: Adw.TabPage | undefined;
    item: T;
};

type ManagedTabProps<T> = {
    handle: TabHandle<T>;
    item: T;
    options: TabCollectionOptions<T>;
    forget: (handle: TabHandle<T>) => void;
};

const ManagedTab = <T,>({ handle, item, options, forget }: ManagedTabProps<T>) => {
    const { page: pageRef, parent, getPage } = handle;
    useEffect(() => () => forget(handle), [handle, forget]);
    return <AdwTabPage {...options.pageProps(item, getPage)} ref={pageRef} parent={parent} />;
};

const ownerOf = (page: Adw.TabPage): Adw.TabView => {
    const owner = page.getChild().getAncestor(getClassType(Adw.TabView));
    if (!(owner instanceof Adw.TabView)) throw new Error("The tab has no native view");
    return owner;
};

/**
 * Creates a collection of JSX pages whose React state survives native transfers and source-window
 * closure. Call append from an event handler because it commits synchronously. Page content lives in
 * independent roots: pass context-dependent values through the item or wrap the content in providers.
 */
const createTabCollection = <T,>(options: TabCollectionOptions<T>): TabCollection<T> => {
    const handles = new Set<TabHandle<T>>();
    const forget = (handle: TabHandle<T>) => {
        handles.delete(handle);
    };
    const find = (page: Adw.TabPage) => [...handles].find((handle) => handle.page.current === page);
    const render = (handle: TabHandle<T>) => {
        handle.root.render(<ManagedTab handle={handle} item={handle.item} options={options} forget={forget} />);
    };
    const remove = (handle: TabHandle<T>) => {
        handles.delete(handle);
        handle.root.unmount();
    };

    return {
        append: (view, item, appendOptions = {}) => {
            if (appendOptions.parent && ownerOf(appendOptions.parent) !== view) {
                throw new RangeError("The parent page belongs to another tab view");
            }
            const pageRef = createRef<Adw.TabPage>();
            const handle: TabHandle<T> = {
                root: createRoot(view),
                page: pageRef,
                getPage: () => pageRef.current,
                parent: appendOptions.parent,
                item,
            };
            handles.add(handle);
            try {
                flushSync(() => render(handle));
            } catch (error) {
                remove(handle);
                throw error;
            }
            const page = handle.page.current;
            if (page === null) {
                remove(handle);
                throw new Error("The tab page did not render");
            }
            if (appendOptions.parent === undefined) {
                view.reorderPage(page, page.getPinned() ? view.getNPinnedPages() - 1 : view.getNPages() - 1);
            }
            if (appendOptions.select !== false) view.setSelectedPage(page);
            return page;
        },
        get: (page) => find(page)?.item,
        update: (page, item) => {
            const handle = find(page);
            if (handle === undefined) throw new Error("The tab is not managed by this collection");
            handle.item = item;
            render(handle);
        },
        remove: (page) => {
            const handle = find(page);
            if (handle) remove(handle);
        },
        removeView: (view) => {
            const pages = Array.from({ length: view.getNPages() }, (_, index) => view.getNthPage(index));
            for (const page of pages) {
                const handle = find(page);
                if (handle) remove(handle);
            }
        },
        transfer: (page, target, position) => {
            if (find(page) === undefined) throw new Error("The tab is not managed by this collection");
            const source = ownerOf(page);
            const minimum = page.getPinned() ? 0 : target.getNPinnedPages();
            const maximum = page.getPinned() ? target.getNPinnedPages() : target.getNPages();
            const index = position ?? maximum;
            if (!Number.isInteger(index) || index < minimum || index > maximum) {
                throw new RangeError("The position is outside the tab's pinned or unpinned group");
            }
            if (source === target) {
                target.reorderPage(page, Math.min(index, maximum - 1));
            } else {
                source.transferPage(page, target, index);
            }
        },
        dispose: () => {
            for (const handle of [...handles]) remove(handle);
        },
    };
};

export { createTabCollection };
