import type * as GObject from "@gtkx/gi/gobject";
import type { NavigationState, ParamListBase, RouteProp } from "@react-navigation/core";
import type { ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import { AdwBin, AdwTabBar, AdwTabOverview, AdwToolbarView } from "@gtkx/jsx/adw";
import { createPortal, useProperty, useSignal } from "@gtkx/react";
import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { PageRecord, PageStore } from "./page-registry.js";
import type {
    TabViewDescriptor,
    TabViewDescriptorMap,
    TabViewIcon,
    TabViewNavigationConfig,
    TabViewNavigationHelpers,
    TabViewNavigationOptions,
    TabViewNavigationState,
} from "./types.js";
import { HeaderBar } from "../shared/header-bar.js";
import { getFocusedRoute, requireDescriptor } from "../shared/routes.js";
import { createPageStore, ownerOf, recordOf, registerPage } from "./page-registry.js";
import { createRouteKey, TabViewActions } from "./tab-view-router.js";

type State = TabViewNavigationState<ParamListBase>;
type Route = State["routes"][number];
type RouteList = Pick<NavigationState, "routes" | "index">;

type TabViewHostProps = TabViewNavigationConfig & {
    view: Adw.TabView;
    state: State;
    navigation: TabViewNavigationHelpers;
    descriptors: TabViewDescriptorMap;
};

type TabContentProps = {
    descriptor: TabViewDescriptor;
    isFocused: boolean;
};

/** The native view of the surrounding tab view navigator and access to its pages. */
type TabViewHandle = {
    /** The `Adw.TabView` the navigator renders into. */
    view: Adw.TabView;
    /** Returns the native page of a route, or `null` when it is not in this view. */
    getPage: (key: string) => Adw.TabPage | null;
    /** Moves a route's page into another view, appending to its pinned or unpinned group by default. */
    transferTab: (key: string, target: Adw.TabView, position?: number) => void;
};

const TabViewContext = createContext<TabViewHandle | null>(null);

/** Returns the surrounding tab view navigator's native view and page access. */
const useTabView = (): TabViewHandle => {
    const handle = useContext(TabViewContext);

    if (handle === null) {
        throw new Error("useTabView must be called inside a tab view navigator.");
    }

    return handle;
};

const hasRoute = (state: RouteList, key: string): boolean => state.routes.some((route) => route.key === key);

const focusedKey = (state: RouteList): string | undefined => state.routes[state.index]?.key;

const toIcon = (icon: TabViewIcon | null | undefined): Gio.Icon | null =>
    typeof icon === "string" ? Gio.ThemedIcon.new(icon) : (icon ?? null);

const applyPageOptions = (record: PageRecord, route: Route, options: TabViewNavigationOptions): void => {
    const { page, applied } = record;
    const title = options.title ?? route.name;

    if (applied.title !== title) page.setTitle(title);
    if (applied.icon !== options.icon) page.setIcon(toIcon(options.icon));
    if (applied.tooltip !== options.tooltip) page.setTooltip(options.tooltip ?? "");
    if (applied.keyword !== options.keyword) page.setKeyword(options.keyword ?? "");
    if (applied.loading !== options.loading) page.setLoading(options.loading ?? false);
    if (applied.needsAttention !== options.needsAttention) page.setNeedsAttention(options.needsAttention ?? false);
    if (applied.indicatorIcon !== options.indicatorIcon) page.setIndicatorIcon(toIcon(options.indicatorIcon));
    if (applied.indicatorActivatable !== options.indicatorActivatable) {
        page.setIndicatorActivatable(options.indicatorActivatable ?? false);
    }
    if (applied.indicatorTooltip !== options.indicatorTooltip) page.setIndicatorTooltip(options.indicatorTooltip ?? "");
    if (applied.liveThumbnail !== options.liveThumbnail) page.setLiveThumbnail(options.liveThumbnail ?? false);
    if (applied.thumbnailXalign !== options.thumbnailXalign) page.setThumbnailXalign(options.thumbnailXalign ?? 0);
    if (applied.thumbnailYalign !== options.thumbnailYalign) page.setThumbnailYalign(options.thumbnailYalign ?? 0);

    record.applied = {
        title,
        icon: options.icon,
        tooltip: options.tooltip,
        keyword: options.keyword,
        loading: options.loading,
        needsAttention: options.needsAttention,
        indicatorIcon: options.indicatorIcon,
        indicatorActivatable: options.indicatorActivatable,
        indicatorTooltip: options.indicatorTooltip,
        liveThumbnail: options.liveThumbnail,
        thumbnailXalign: options.thumbnailXalign,
        thumbnailYalign: options.thumbnailYalign,
    };
};

const createPage = (view: Adw.TabView, store: PageStore, state: State, route: Route, position: number): PageRecord => {
    const host = new Adw.Bin();
    const parentKey = state.parents[route.key];
    const parent = parentKey === undefined ? undefined : store.get(parentKey);
    const pinnedCount = view.getNPinnedPages();
    const page = state.pinnedKeys.includes(route.key)
        ? view.insertPinned(host, Math.min(position, pinnedCount))
        : parent !== undefined && ownerOf(parent.page) === view
          ? view.addPage(host, parent.page)
          : view.insert(host, Math.min(Math.max(position, pinnedCount), view.getNPages()));
    const record: PageRecord = { key: route.key, name: route.name, params: route.params, page, host, applied: {} };

    registerPage(record);
    store.set(record);

    return record;
};

const presentRecord = (view: Adw.TabView, store: PageStore, key: string): PageRecord | undefined => {
    const record = store.get(key);

    return record !== undefined && ownerOf(record.page) === view ? record : undefined;
};

const adoptPages = (view: Adw.TabView, store: PageStore): void => {
    for (let position = 0; position < view.getNPages(); position += 1) {
        const record = recordOf(view.getNthPage(position));

        if (record !== undefined && store.get(record.key) === undefined) {
            store.set(record);
        }
    }
};

const syncPages = (view: Adw.TabView, store: PageStore, state: State, descriptors: TabViewDescriptorMap): void => {
    adoptPages(view, store);

    for (const key of store.keys()) {
        if (!hasRoute(state, key)) {
            const record = store.get(key);
            store.delete(key);

            if (record !== undefined && ownerOf(record.page) === view) {
                view.closePage(record.page);
            }
        }
    }

    state.routes.forEach((route, position) => {
        if (store.get(route.key) === undefined) {
            createPage(view, store, state, route, position);
        }
    });

    const present = state.routes.flatMap((route) => {
        const record = presentRecord(view, store, route.key);

        return record === undefined ? [] : [{ route, record }];
    });

    for (const { route, record } of present) {
        const pinned = state.pinnedKeys.includes(route.key);

        if (record.page.getPinned() !== pinned) {
            view.setPagePinned(record.page, pinned);
        }
    }

    present.forEach(({ record }, position) => {
        if (view.getPagePosition(record.page) !== position) {
            view.reorderPage(record.page, position);
        }
    });

    for (const { route, record } of present) {
        record.name = route.name;
        record.params = route.params;
        applyPageOptions(record, route, descriptors[route.key]?.options ?? {});
    }

    const focus = focusedKey(state);
    const focused = presentRecord(view, store, focus ?? "");

    if (focus !== store.lastFocus) {
        store.lastFocus = focus;

        if (focused !== undefined && view.getSelectedPage() !== focused.page) {
            view.setSelectedPage(focused.page);
        }
    }
};

const TabContent = ({ descriptor, isFocused }: TabContentProps): ReactNode => {
    const shouldLoad = isFocused || descriptor.options.lazy === false;
    const [hasLoaded, setHasLoaded] = useState(shouldLoad);

    if (shouldLoad && !hasLoaded) {
        setHasLoaded(true);
    }

    return hasLoaded ? descriptor.render() : null;
};

const TabViewHost = (props: TabViewHostProps): ReactNode => {
    const { view, state, navigation, descriptors } = props;
    const { tabBarVisible, tabBarAutohide, tabBarExpand, tabBarInverted, overview, menuModel } = props;
    const { extraDropTarget, onExtraDragDrop, onCreateWindow, onSetupMenu, shortcuts, defaultIcon } = props;
    const [store] = useState(createPageStore);
    const [placeholder, setPlaceholder] = useState<Adw.Bin | null>(null);
    const [overviewWidget, setOverviewWidget] = useState<Adw.TabOverview | null>(null);
    const selectedPage = useProperty(view, "selectedPage");
    const focused = getFocusedRoute(state);
    const descriptor = requireDescriptor(descriptors, focused.key);

    useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);

    const routeOf = (page: Adw.TabPage): RouteProp<ParamListBase> | undefined => {
        const key = recordOf(page)?.key;

        return key === undefined ? undefined : descriptors[key]?.route;
    };

    const [handle] = useState<TabViewHandle>(() => ({
        view,
        getPage: (key) => presentRecord(view, store, key)?.page ?? null,
        transferTab: (key, target, position) => {
            const record = presentRecord(view, store, key);

            if (record === undefined) {
                throw new Error(`Route "${key}" has no page in this tab view.`);
            }

            const pinned = record.page.getPinned();
            const minimum = pinned ? 0 : target.getNPinnedPages();
            const maximum = pinned ? target.getNPinnedPages() : target.getNPages();
            const index = position ?? maximum;

            if (!Number.isInteger(index) || index < minimum || index > maximum) {
                throw new RangeError("The position is outside the tab's pinned or unpinned group.");
            }

            view.transferPage(record.page, target, index);
        },
    }));

    useLayoutEffect(() => {
        overviewWidget?.setOpen(overview?.open ?? false);
    }, [overviewWidget, overview?.open]);

    useLayoutEffect(() => {
        if (placeholder === null) {
            return;
        }

        placeholder.setChild(view);

        return () => {
            if (placeholder.getChild() === view) {
                placeholder.setChild(null);
            }
        };
    }, [placeholder, view]);

    useLayoutEffect(() => {
        view.setMenuModel(menuModel ?? null);
    }, [view, menuModel]);

    useLayoutEffect(() => {
        if (shortcuts !== undefined) {
            view.setShortcuts(shortcuts);
        }
    }, [view, shortcuts]);

    useLayoutEffect(() => {
        const icon = toIcon(defaultIcon);

        if (icon !== null) {
            view.setDefaultIcon(icon);
        }
    }, [view, defaultIcon]);

    useLayoutEffect(() => {
        syncPages(view, store, state, descriptors);
    }, [view, store, state, descriptors]);

    useLayoutEffect(() => {
        const selected = view.getSelectedPage();
        const key = selected === null ? undefined : recordOf(selected)?.key;
        const current = navigation.getState();

        if (key === undefined || !hasRoute(current, key) || focusedKey(current) === key) {
            return;
        }

        const event = navigation.emit({ type: "tabPress", target: key, canPreventDefault: true });

        if (event.defaultPrevented) {
            const previous = presentRecord(view, store, focusedKey(current) ?? "");

            if (previous !== undefined) {
                view.setSelectedPage(previous.page);
            }

            return;
        }

        navigation.dispatch(TabViewActions.selectTab(key));
    }, [selectedPage, navigation, view, store]);

    useSignal(view, "close-page", (page) => {
        const key = recordOf(page)?.key;

        if (key === undefined || !hasRoute(navigation.getState(), key)) {
            view.closePageFinish(page, true);

            return true;
        }

        navigation.dispatch(TabViewActions.closeTab(key));
        view.closePageFinish(page, !hasRoute(navigation.getState(), key));

        return true;
    });

    useSignal(view, "page-attached", (page, position) => {
        const record = recordOf(page);

        if (record === undefined || hasRoute(navigation.getState(), record.key)) {
            return;
        }

        store.set(record);
        navigation.dispatch({
            type: "OPEN_TAB",
            payload: {
                name: record.name,
                params: record.params,
                key: record.key,
                position,
                pinned: page.getPinned(),
                select: false,
            },
        });
    });

    useSignal(view, "page-detached", (page) => {
        const key = recordOf(page)?.key;

        if (key !== undefined && hasRoute(navigation.getState(), key)) {
            navigation.dispatch(TabViewActions.closeTab(key));
        }
    });

    useSignal(view, "page-reordered", (page, position) => {
        const key = recordOf(page)?.key;

        if (key !== undefined && hasRoute(navigation.getState(), key)) {
            navigation.dispatch(TabViewActions.reorderTab(key, position));
        }
    });

    useSignal(view, "indicator-activated", (page) => {
        const key = recordOf(page)?.key;

        if (key !== undefined && hasRoute(navigation.getState(), key)) {
            navigation.emit({ type: "indicatorActivated", target: key });
        }
    });

    useSignal(view, "setup-menu", (page) => {
        onSetupMenu?.(page === null ? null : (routeOf(page) ?? null));
    });

    useSignal(view, "create-window", () => onCreateWindow?.() ?? undefined);

    const createTab = (): Adw.TabPage | undefined => {
        const target = overview?.onCreateTab?.();

        if (target === undefined) {
            return undefined;
        }

        const host = new Adw.Bin();
        const page = view.append(host);
        const record: PageRecord = {
            key: createRouteKey(target.name),
            name: target.name,
            params: target.params,
            page,
            host,
            applied: {},
        };

        registerPage(record);
        store.set(record);
        navigation.dispatch({
            type: "OPEN_TAB",
            payload: {
                name: record.name,
                params: record.params,
                key: record.key,
                position: view.getPagePosition(page),
            },
        });

        if (!hasRoute(navigation.getState(), record.key)) {
            store.delete(record.key);
            view.closePage(page);

            return undefined;
        }

        return page;
    };

    const drop = (page: Adw.TabPage, value: GObject.Value): boolean => {
        const route = routeOf(page);

        return route === undefined ? false : (onExtraDragDrop?.(route, value) ?? false);
    };

    const header =
        descriptor.options.headerShown === false ? null : descriptor.options.header === undefined ? (
            <HeaderBar options={descriptor.options} />
        ) : (
            <>
                {descriptor.options.header({
                    route: descriptor.route,
                    navigation: descriptor.navigation,
                    options: descriptor.options,
                })}
            </>
        );

    const content = (
        <AdwToolbarView
            topBar={
                <>
                    {header}
                    <AdwTabBar
                        view={view}
                        visible={tabBarVisible ?? true}
                        autohide={tabBarAutohide ?? true}
                        expandTabs={tabBarExpand ?? true}
                        inverted={tabBarInverted ?? false}
                        extraDropTarget={extraDropTarget ?? null}
                        onExtraDragDrop={drop}
                    />
                </>
            }
        >
            <AdwBin ref={setPlaceholder} />
        </AdwToolbarView>
    );

    return (
        <TabViewContext.Provider value={handle}>
            {overview === undefined ? (
                content
            ) : (
                <AdwTabOverview
                    ref={setOverviewWidget}
                    view={view}
                    enableNewTab={overview.enableNewTab === true && overview.onCreateTab !== undefined}
                    enableSearch={overview.enableSearch ?? true}
                    extraDropTarget={extraDropTarget ?? null}
                    onCreateTab={createTab}
                    onExtraDragDrop={drop}
                    onNotifyOpen={(open) => overview.onOpenChange?.(open ?? false)}
                >
                    {content}
                </AdwTabOverview>
            )}
            {state.routes.map((route) => {
                const record = presentRecord(view, store, route.key);

                return record === undefined
                    ? null
                    : createPortal(
                          <TabContent
                              descriptor={requireDescriptor(descriptors, route.key)}
                              isFocused={route.key === focused.key}
                          />,
                          record.host,
                          route.key,
                      );
            })}
        </TabViewContext.Provider>
    );
};

export { type TabViewHandle, TabViewHost, useTabView };
