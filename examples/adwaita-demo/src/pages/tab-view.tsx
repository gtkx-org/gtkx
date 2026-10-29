import type { NavigationAction, NavigationState } from "@gtkx/navigation";
import * as Adw from "@gtkx/gi/adw";
import * as Gdk from "@gtkx/gi/gdk";
import type * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwBin,
    AdwBreakpoint,
    AdwHeaderBar,
    AdwStatusPage,
    AdwTabButton,
    AdwToolbarView,
    AdwWindow,
} from "@gtkx/jsx/adw";
import { GMenu, GSimpleAction, GSimpleActionGroup } from "@gtkx/jsx/gio";
import { GtkButton, GtkCallbackAction, GtkEntry, GtkShortcut, GtkShortcutController } from "@gtkx/jsx/gtk";
import {
    CommonActions,
    createNavigationContainerRef,
    createTabViewNavigator,
    NavigationContainer,
    TabViewActions,
    type TabViewNavigationState,
    type TabViewScreenProps,
    useNavigationState,
    usePreventRemove,
} from "@gtkx/navigation";
import { createPortal, rootElement, useApplication, useSignal } from "@gtkx/react";
import { useState, useSyncExternalStore } from "react";

type TabData = {
    title: string;
    iconName: string;
    showIcon: boolean;
    color: number;
    loading: boolean;
    attention: boolean;
    indicator: boolean;
    muted: boolean;
};

type TabParams = { Tab: TabData };
type TabState = TabViewNavigationState<TabParams>;
type DemoWindowEntry = { key: string; view: Adw.TabView; populate: boolean };

const Tabs = createTabViewNavigator<TabParams>();
const narrowCondition = Adw.BreakpointCondition.parse("max-width: 600px");
const extraDropTarget = { actions: Gdk.DragAction.COPY, types: [GObject.typeFromName("gchararray")] };

const escapeMarkup = (text: string) => GLib.markupEscapeText(text, -1);

let windows: DemoWindowEntry[] = [];
let nextWindow = 1;
let nextTab = 1;
const listeners = new Set<() => void>();

const notifyWindows = () => {
    for (const listener of listeners) listener();
};

const openWindow = (view: Adw.TabView, populate: boolean): Adw.TabView => {
    windows = [...windows, { key: `window-${nextWindow++}`, view, populate }];
    notifyWindows();
    return view;
};

const closeWindow = (key: string) => {
    windows = windows.filter((entry) => entry.key !== key);
    notifyWindows();
};

const subscribeWindows = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const getWindows = () => windows;

const randomIcon = (view: Adw.TabView): string => {
    const names = Gtk.IconTheme.getForDisplay(view.getDisplay()).getIconNames();
    return names[Math.floor(Math.random() * names.length)] ?? "text-x-generic-symbolic";
};

const newTabData = (view: Adw.TabView): TabData => ({
    title: `Tab ${nextTab++}`,
    iconName: randomIcon(view),
    showIcon: true,
    color: Math.floor(Math.random() * 8) + 1,
    loading: false,
    attention: false,
    indicator: false,
    muted: false,
});

const isTabState = (state: NavigationState | undefined): state is TabState => state?.type === "tabview";

const TabContent = ({ route, navigation }: TabViewScreenProps<TabParams, "Tab">) => {
    const pinned = useNavigationState((state) => isTabState(state) && state.pinnedKeys.includes(route.key));
    usePreventRemove(pinned, () => undefined);

    return (
        <AdwBin cssClasses={["tab-page", `tab-page-color-${route.params.color}`]}>
            <GtkEntry
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                text={route.params.title}
                accessibleLabel="Tab title"
                onChanged={(entry) => navigation.setParams({ title: entry.getText() })}
            />
        </AdwBin>
    );
};

type ToggleProps = { name: string; value: boolean; onChange: (value: boolean) => void };
type ShortcutProps = { trigger: string; onActivate: () => void };

const Toggle = ({ name, value, onChange }: ToggleProps) => (
    <GSimpleAction
        name={name}
        state={GLib.Variant.newBoolean(value)}
        onChangeState={(next) => {
            if (next) onChange(next.getBoolean());
        }}
    />
);

const Shortcut = ({ trigger, onActivate }: ShortcutProps) => (
    <GtkShortcut
        trigger={Gtk.ShortcutTrigger.parseString(trigger) ?? undefined}
        action={
            <GtkCallbackAction
                callback={() => {
                    onActivate();
                    return true;
                }}
            />
        }
    />
);

const DemoWindow = ({ entry }: { entry: DemoWindowEntry }) => {
    const { key, view, populate } = entry;
    const application = useApplication();
    const [container] = useState(() => createNavigationContainerRef<TabParams>());
    const [state, setState] = useState<TabState | undefined>(undefined);
    const [initialTab] = useState(() => newTabData(view));
    const [narrow, setNarrow] = useState(false);
    const [open, setOpen] = useState(false);
    const [menuKey, setMenuKey] = useState<string | null>(null);
    const [menu, setMenu] = useState<Gio.Menu | null>(null);
    const [style] = useState(() => Adw.StyleManager.getDefault());
    useSignal(style, "notify::dark", () => view.invalidateThumbnails());
    useSignal(style, "notify::high-contrast", () => view.invalidateThumbnails());

    const routes = state?.routes ?? [];
    const pinnedKeys = state?.pinnedKeys ?? [];
    const menuTab = routes.find((route) => route.key === menuKey) ?? routes[state?.index ?? 0];
    const pinned = menuTab !== undefined && pinnedKeys.includes(menuTab.key);
    const position = menuTab === undefined ? -1 : routes.indexOf(menuTab);
    const previous = position > 0 ? routes[position - 1] : undefined;
    const closeBefore = !pinned && previous !== undefined && !pinnedKeys.includes(previous.key);
    const closeAfter = position >= 0 && position < routes.length - 1;

    const dispatch = (action: NavigationAction) => {
        if (container.isReady()) container.dispatch(action);
    };
    const update = (patch: Partial<TabData>) => {
        if (menuTab) dispatch({ ...CommonActions.setParams(patch), source: menuTab.key });
    };
    const createTab = () => dispatch(TabViewActions.openTab("Tab", newTabData(view)));
    const moveToNewWindow = () => {
        if (menuTab && position >= 0) {
            view.transferPage(view.getNthPage(position), openWindow(new Adw.TabView(), false), 0);
        }
    };
    const readState = () => {
        const root = container.getRootState();
        setState(isTabState(root) ? root : undefined);
    };
    const openPopulatedWindow = () => {
        openWindow(new Adw.TabView(), true);
    };
    const duplicate = () => {
        if (menuTab) dispatch(TabViewActions.openTab("Tab", { ...menuTab.params }, { parent: menuTab.key }));
    };
    const pin = (value: boolean) => {
        if (menuTab) dispatch(TabViewActions.pinTab(menuTab.key, value));
    };
    const close = () => {
        if (menuTab) dispatch(TabViewActions.closeTab(menuTab.key));
    };
    const closeOthers = () => {
        if (menuTab) dispatch(TabViewActions.closeOtherTabs(menuTab.key));
    };
    const closeBeforeTab = () => {
        if (menuTab) dispatch(TabViewActions.closeTabsBefore(menuTab.key));
    };
    const closeAfterTab = () => {
        if (menuTab) dispatch(TabViewActions.closeTabsAfter(menuTab.key));
    };
    const refreshIcon = () => update({ iconName: randomIcon(view) });
    const setShowIcon = (showIcon: boolean) => update({ showIcon });
    const setLoading = (loading: boolean) => update({ loading });
    const setAttention = (attention: boolean) => update({ attention });
    const setIndicator = (indicator: boolean) => update({ indicator });
    const toggleOverview = () => setOpen((value) => !value);

    return (
        <AdwWindow
            application={application}
            title="Tab View Demo"
            defaultWidth={800}
            defaultHeight={600}
            onCloseRequest={() => {
                closeWindow(key);
                return true;
            }}
            breakpoints={
                <AdwBreakpoint
                    condition={narrowCondition}
                    onApply={() => setNarrow(true)}
                    onUnapply={() => setNarrow(false)}
                />
            }
            actionGroups={
                <>
                    <GSimpleActionGroup
                        prefix="win"
                        actions={
                            <>
                                <GSimpleAction name="window-new" onActivate={openPopulatedWindow} />
                                <GSimpleAction name="tab-new" onActivate={createTab} />
                            </>
                        }
                    />
                    <GSimpleActionGroup
                        prefix="tab"
                        actions={
                            <>
                                <GSimpleAction
                                    name="move-to-new-window"
                                    enabled={!pinned && routes.length > 1}
                                    onActivate={moveToNewWindow}
                                />
                                <GSimpleAction name="duplicate" onActivate={duplicate} />
                                <GSimpleAction name="pin" enabled={!pinned} onActivate={() => pin(true)} />
                                <GSimpleAction name="unpin" enabled={pinned} onActivate={() => pin(false)} />
                                <GSimpleAction name="close" enabled={!pinned} onActivate={close} />
                                <GSimpleAction
                                    name="close-other"
                                    enabled={closeBefore || closeAfter}
                                    onActivate={closeOthers}
                                />
                                <GSimpleAction name="close-before" enabled={closeBefore} onActivate={closeBeforeTab} />
                                <GSimpleAction name="close-after" enabled={closeAfter} onActivate={closeAfterTab} />
                                <GSimpleAction
                                    name="refresh-icon"
                                    enabled={menuTab?.params.showIcon ?? false}
                                    onActivate={refreshIcon}
                                />
                                <Toggle name="icon" value={menuTab?.params.showIcon ?? false} onChange={setShowIcon} />
                                <Toggle name="loading" value={menuTab?.params.loading ?? false} onChange={setLoading} />
                                <Toggle
                                    name="needs-attention"
                                    value={menuTab?.params.attention ?? false}
                                    onChange={setAttention}
                                />
                                <Toggle
                                    name="indicator"
                                    value={menuTab?.params.indicator ?? false}
                                    onChange={setIndicator}
                                />
                            </>
                        }
                    />
                </>
            }
            controllers={
                <GtkShortcutController
                    scope={Gtk.ShortcutScope.MANAGED}
                    shortcuts={
                        <>
                            <Shortcut trigger="<Control>n" onActivate={openPopulatedWindow} />
                            <Shortcut trigger="<Control>t" onActivate={createTab} />
                            <Shortcut trigger="<Control>w" onActivate={close} />
                            <Shortcut trigger="<Control><Shift>o" onActivate={toggleOverview} />
                        </>
                    }
                />
            }
        >
            {createPortal(
                <GMenu
                    ref={setMenu}
                    items={[
                        {
                            section: [
                                { label: "_Move to New Window", action: "tab.move-to-new-window" },
                                { label: "D_uplicate", action: "tab.duplicate" },
                            ],
                        },
                        {
                            section: [
                                {
                                    label: pinned ? "Unp_in Tab" : "P_in Tab",
                                    action: pinned ? "tab.unpin" : "tab.pin",
                                },
                            ],
                        },
                        {
                            section: [
                                { label: "Icon", action: "tab.icon" },
                                { label: "R_efresh Icon", action: "tab.refresh-icon" },
                            ],
                        },
                        {
                            section: [
                                { label: "Loa_ding", action: "tab.loading" },
                                { label: "Needs _Attention", action: "tab.needs-attention" },
                                { label: "Indicator", action: "tab.indicator" },
                            ],
                        },
                        {
                            section: [
                                { label: "Close _Other Tabs", action: "tab.close-other" },
                                { label: "Close Tabs to the _Left", action: "tab.close-before" },
                                { label: "Close Tabs to the _Right", action: "tab.close-after" },
                            ],
                        },
                        { section: [{ label: "_Close", action: "tab.close" }] },
                    ]}
                />,
                rootElement,
            )}
            <NavigationContainer
                ref={container}
                onReady={() => {
                    readState();
                    if (populate) {
                        dispatch(TabViewActions.openTab("Tab", newTabData(view)));
                        dispatch(TabViewActions.openTab("Tab", newTabData(view)));
                    }
                }}
                onStateChange={readState}
                onUnhandledAction={(unhandled) => {
                    if (unhandled.type === "CLOSE_TAB") closeWindow(key);
                }}
            >
                <Tabs.Navigator
                    view={view}
                    tabBarVisible={!narrow}
                    extraDropTarget={extraDropTarget}
                    onExtraDragDrop={(route, value) => {
                        const title = value.getString();
                        if (title === null) return false;
                        dispatch({ ...CommonActions.setParams({ title }), source: route.key });
                        return true;
                    }}
                    onCreateWindow={() => openWindow(new Adw.TabView(), false)}
                    onSetupMenu={(route) => setMenuKey(route?.key ?? null)}
                    menuModel={menu}
                    overview={{
                        open,
                        onOpenChange: (value) => {
                            setOpen(value);
                            if (!value && view.getNPages() === 0) closeWindow(key);
                        },
                        enableNewTab: true,
                        onCreateTab: () => ({ name: "Tab", params: newTabData(view) }),
                    }}
                    screenOptions={({ route }) => ({
                        title: route.params.title,
                        tooltip: `Elaborate tooltip for <b>${escapeMarkup(route.params.title)}</b>`,
                        icon: route.params.showIcon ? route.params.iconName : null,
                        loading: route.params.loading,
                        needsAttention: route.params.attention,
                        indicatorIcon: route.params.indicator
                            ? route.params.muted
                                ? "tab-audio-muted-symbolic"
                                : "tab-audio-playing-symbolic"
                            : null,
                        indicatorActivatable: true,
                        indicatorTooltip: route.params.indicator
                            ? route.params.muted
                                ? "Unmute Tab"
                                : "Mute Tab"
                            : "",
                        thumbnailXalign: 0.5,
                        thumbnailYalign: 0.5,
                        headerStart: (
                            <GtkButton
                                actionName="win.window-new"
                                iconName="window-new-symbolic"
                                tooltipText="New Window"
                                accessibleLabel="New Window"
                            />
                        ),
                        headerEnd: (
                            <>
                                <AdwTabButton visible={narrow} view={view} onClicked={() => setOpen(true)} />
                                <GtkButton
                                    visible={!narrow}
                                    iconName="view-grid-symbolic"
                                    tooltipText="View Open Tabs"
                                    accessibleLabel="View Open Tabs"
                                    onClicked={() => setOpen(true)}
                                />
                                <GtkButton
                                    visible={!narrow}
                                    actionName="win.tab-new"
                                    iconName="adw-tab-new-symbolic"
                                    tooltipText="New Tab"
                                    accessibleLabel="New Tab"
                                />
                            </>
                        ),
                    })}
                    screenListeners={({ route, navigation }) => ({
                        indicatorActivated: () => navigation.setParams({ muted: !route.params.muted }),
                    })}
                >
                    <Tabs.Screen name="Tab" component={TabContent} initialParams={initialTab} />
                </Tabs.Navigator>
            </NavigationContainer>
        </AdwWindow>
    );
};

const TabDemoWindows = () => {
    const entries = useSyncExternalStore(subscribeWindows, getWindows, getWindows);

    return (
        <>
            {entries.map((entry) => (
                <DemoWindow key={entry.key} entry={entry} />
            ))}
        </>
    );
};

const TabViewPage = () => (
    <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
        <AdwStatusPage
            title="Tab View"
            description="A modern tabbed browsing widget"
            iconName="widget-tab-view-symbolic"
        >
            <GtkButton
                label="Run the Demo"
                halign={Gtk.Align.CENTER}
                onClicked={() => {
                    openWindow(new Adw.TabView(), true);
                }}
            />
        </AdwStatusPage>
    </AdwToolbarView>
);

export { TabDemoWindows, TabViewPage };
