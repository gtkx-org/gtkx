import * as Adw from "@gtkx/gi/adw";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwBin,
    AdwBreakpoint,
    AdwHeaderBar,
    AdwStatusPage,
    AdwTabBar,
    AdwTabButton,
    AdwTabOverview,
    AdwTabPage,
    AdwTabView,
    AdwToolbarView,
    AdwWindow,
} from "@gtkx/jsx/adw";
import { GMenu, GSimpleAction, GSimpleActionGroup } from "@gtkx/jsx/gio";
import { GtkButton, GtkCallbackAction, GtkEntry, GtkShortcut, GtkShortcutController } from "@gtkx/jsx/gtk";
import { createRoot, flushSync, type Root, useApplication, useProperty, useSignal } from "@gtkx/react";
import { createRef, type RefObject, useEffect, useMemo, useState } from "react";

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

type TabHandle = {
    id: number;
    root: Root;
    page: RefObject<Adw.TabPage | null>;
    parent: Adw.TabPage | null;
    data: TabData;
};

type WindowHandle = { root: Root; window: Adw.Window; view: Adw.TabView };
const narrowCondition = Adw.BreakpointCondition.parse("max-width: 600px");
const stringType = GObject.typeFromName("gchararray");

const escapeMarkup = (text: string) => GLib.markupEscapeText(text, -1);

const DemoTab = ({
    id,
    pageRef,
    data,
    parentPage,
    demo,
}: {
    id: number;
    pageRef: RefObject<Adw.TabPage | null>;
    data: TabData;
    parentPage: Adw.TabPage | null;
    demo: TabDemo;
}) => {
    const icon = useMemoIcon(data.showIcon ? data.iconName : null);
    const indicatorIcon = useMemoIcon(
        data.indicator ? (data.muted ? "tab-audio-muted-symbolic" : "tab-audio-playing-symbolic") : null,
    );

    useEffect(() => () => demo.forgetTab(id), [demo, id]);

    return (
        <AdwTabPage
            ref={pageRef}
            parent={parentPage ?? undefined}
            title={data.title}
            tooltip={`Elaborate tooltip for <b>${escapeMarkup(data.title)}</b>`}
            icon={icon}
            loading={data.loading}
            needsAttention={data.attention}
            indicatorIcon={indicatorIcon}
            indicatorTooltip={data.indicator ? (data.muted ? "Unmute Tab" : "Mute Tab") : ""}
            indicatorActivatable
            thumbnailXalign={0.5}
            thumbnailYalign={0.5}
        >
            <AdwBin cssClasses={["tab-page", `tab-page-color-${data.color}`]}>
                <GtkEntry
                    halign={Gtk.Align.CENTER}
                    valign={Gtk.Align.CENTER}
                    text={data.title}
                    accessibleLabel="Tab title"
                    onChanged={(entry) => demo.updateId(id, { title: entry.getText() })}
                />
            </AdwBin>
        </AdwTabPage>
    );
};

const useMemoIcon = (name: string | null) => useMemo(() => (name === null ? null : Gio.ThemedIcon.new(name)), [name]);

class TabDemo {
    private nextId = 1;
    private readonly tabs = new Map<number, TabHandle>();
    private readonly windows = new Map<Adw.TabView, WindowHandle>();

    createWindow(application: Gtk.Application, populate = false): Adw.TabView {
        const root = createRoot();
        const window = createRef<Adw.Window>();
        const view = createRef<Adw.TabView>();
        flushSync(() =>
            root.render(<DemoWindow demo={this} application={application} windowRef={window} viewRef={view} />),
        );
        if (window.current === null || view.current === null) {
            throw new Error("The tab window did not render");
        }
        const handle = { root, window: window.current, view: view.current };
        this.windows.set(handle.view, handle);
        if (populate) {
            for (let index = 0; index < 3; index += 1) {
                this.createTab(handle.view);
            }
        }
        handle.view.invalidateThumbnails();
        return handle.view;
    }

    closeWindow(view: Adw.TabView): void {
        const handle = this.windows.get(view);
        if (handle === undefined) {
            return;
        }
        this.windows.delete(view);
        const pages = Array.from({ length: view.getNPages() }, (_, index) => view.getNthPage(index));
        for (const page of pages) {
            this.releaseTab(page);
        }
        handle.root.unmount();
    }

    forgetWindow(view: Adw.TabView): void {
        this.windows.delete(view);
    }

    createTab(view: Adw.TabView, original?: Adw.TabPage): Adw.TabPage {
        const source = original === undefined ? undefined : this.find(original);
        const id = this.nextId++;
        const data = source
            ? { ...source.data }
            : {
                  title: `Tab ${id}`,
                  iconName: this.randomIcon(view),
                  showIcon: true,
                  color: Math.floor(Math.random() * 8) + 1,
                  loading: false,
                  attention: false,
                  indicator: false,
                  muted: false,
              };
        const handle: TabHandle = {
            id,
            root: createRoot(view),
            page: createRef<Adw.TabPage>(),
            parent: original ?? null,
            data,
        };
        this.tabs.set(id, handle);
        flushSync(() =>
            handle.root.render(
                <DemoTab
                    id={handle.id}
                    pageRef={handle.page}
                    data={handle.data}
                    parentPage={handle.parent}
                    demo={this}
                />,
            ),
        );
        const page = handle.page.current;
        if (page === null) {
            this.tabs.delete(id);
            handle.root.unmount();
            throw new Error("The tab page did not render");
        }
        if (original === undefined) {
            view.reorderPage(page, view.getNPages() - 1);
        }
        view.setSelectedPage(page);
        page.getChild().childFocus(Gtk.DirectionType.TAB_FORWARD);
        return page;
    }

    find(page: Adw.TabPage): TabHandle | undefined {
        return [...this.tabs.values()].find((handle) => handle.page.current === page);
    }

    update(handle: TabHandle, update: Partial<TabData>): void {
        handle.data = { ...handle.data, ...update };
        handle.root.render(
            <DemoTab id={handle.id} pageRef={handle.page} data={handle.data} parentPage={handle.parent} demo={this} />,
        );
    }

    updateId(id: number, update: Partial<TabData>): void {
        const handle = this.tabs.get(id);
        if (handle) {
            this.update(handle, update);
        }
    }

    updatePage(page: Adw.TabPage | null | undefined, update: Partial<TabData>): void {
        const handle = page ? this.find(page) : undefined;
        if (handle) {
            this.update(handle, update);
        }
    }

    toggleMute(page: Adw.TabPage): void {
        const handle = this.find(page);
        if (handle) {
            this.update(handle, { muted: !handle.data.muted });
        }
    }

    releaseTab(page: Adw.TabPage): void {
        const handle = this.find(page);
        if (handle) {
            this.tabs.delete(handle.id);
            handle.root.unmount();
        }
    }

    forgetTab(id: number): void {
        this.tabs.delete(id);
    }

    randomIcon(view: Adw.TabView): string {
        const names = Gtk.IconTheme.getForDisplay(view.getDisplay()).getIconNames();
        return names[Math.floor(Math.random() * names.length)] ?? "text-x-generic-symbolic";
    }
}

type DemoWindowProps = {
    demo: TabDemo;
    application: Gtk.Application;
    windowRef: RefObject<Adw.Window | null>;
    viewRef: RefObject<Adw.TabView | null>;
};

const DemoWindow = ({ demo, application, windowRef, viewRef }: DemoWindowProps) => {
    const [view, setView] = useState<Adw.TabView | null>(null);
    const [overview, setOverview] = useState<Adw.TabOverview | null>(null);
    const [narrow, setNarrow] = useState(false);
    const [open, setOpen] = useState(false);
    const [menuPage, setMenuPage] = useState<Adw.TabPage | null>(null);
    const selectedPage = useProperty(view, "selectedPage");
    const current = menuPage ?? selectedPage;
    const pinned = useProperty(current, "pinned") ?? false;
    const hasIcon = useProperty(current, "icon") != null;
    const loading = useProperty(current, "loading") ?? false;
    const attention = useProperty(current, "needsAttention") ?? false;
    const hasIndicator = useProperty(current, "indicatorIcon") != null;
    const count = useProperty(view, "nPages") ?? 0;
    const [order, setOrder] = useState(0);
    const position = useMemo(() => {
        void order;
        return view && current ? view.getPagePosition(current) : -1;
    }, [view, current, order]);
    const previous = view && position > 0 ? view.getNthPage(position - 1) : null;
    const closeBefore = !pinned && previous !== null && !previous.getPinned();
    const closeAfter = position >= 0 && position < count - 1;
    const [style] = useState(() => Adw.StyleManager.getDefault());
    useSignal(style, "notify::dark", () => view?.invalidateThumbnails());
    useSignal(style, "notify::high-contrast", () => view?.invalidateThumbnails());

    useEffect(
        () => () => {
            if (view) demo.forgetWindow(view);
        },
        [demo, view],
    );
    const createTab = () => (view ? demo.createTab(view) : undefined);
    const move = () => {
        if (view && current) {
            const target = demo.createWindow(application);
            view.transferPage(current, target, 0);
        }
    };
    const closeEmpty = (self: Adw.TabView) => {
        queueMicrotask(() => {
            if (self.getNPages() === 0 && !overview?.getOpen()) {
                demo.closeWindow(self);
            }
        });
    };
    const drop = (page: Adw.TabPage, value: GObject.Value) => {
        const title = value.getString();
        if (title === null) return false;
        demo.updatePage(page, { title });
        return true;
    };
    const action = (name: string, callback: () => void, enabled = true) => (
        <GSimpleAction key={name} name={name} enabled={enabled} onActivate={callback} />
    );
    const stateful = (name: string, value: boolean, update: (value: boolean) => void) => (
        <GSimpleAction
            key={name}
            name={name}
            state={GLib.Variant.newBoolean(value)}
            onChangeState={(next) => {
                if (next) update(next.getBoolean());
            }}
        />
    );
    const shortcuts = [
        {
            trigger: "<Control>n",
            callback: () => {
                demo.createWindow(application, true);
            },
        },
        {
            trigger: "<Control>t",
            callback: () => {
                createTab();
            },
        },
        {
            trigger: "<Control>w",
            callback: () => {
                if (current) view?.closePage(current);
            },
        },
        { trigger: "<Control><Shift>o", callback: () => setOpen((value) => !value) },
    ];

    return (
        <AdwWindow
            ref={windowRef}
            application={application}
            title="Tab View Demo"
            defaultWidth={800}
            defaultHeight={600}
            onCloseRequest={() => {
                if (view) demo.closeWindow(view);
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
                                {action("window-new", () => {
                                    demo.createWindow(application, true);
                                })}
                                {action("tab-new", () => {
                                    createTab();
                                })}
                            </>
                        }
                    />
                    <GSimpleActionGroup
                        prefix="tab"
                        actions={
                            <>
                                {action("move-to-new-window", move, !pinned && count > 1)}
                                {action("duplicate", () => {
                                    if (view && current) demo.createTab(view, current);
                                })}
                                {action(
                                    "pin",
                                    () => {
                                        if (current) view?.setPagePinned(current, true);
                                    },
                                    !pinned,
                                )}
                                {action(
                                    "unpin",
                                    () => {
                                        if (current) view?.setPagePinned(current, false);
                                    },
                                    pinned,
                                )}
                                {action(
                                    "close",
                                    () => {
                                        if (current) view?.closePage(current);
                                    },
                                    !pinned,
                                )}
                                {action(
                                    "close-other",
                                    () => {
                                        if (current) view?.closeOtherPages(current);
                                    },
                                    closeBefore || closeAfter,
                                )}
                                {action(
                                    "close-before",
                                    () => {
                                        if (current) view?.closePagesBefore(current);
                                    },
                                    closeBefore,
                                )}
                                {action(
                                    "close-after",
                                    () => {
                                        if (current) view?.closePagesAfter(current);
                                    },
                                    closeAfter,
                                )}
                                {action(
                                    "refresh-icon",
                                    () => {
                                        if (view) demo.updatePage(current, { iconName: demo.randomIcon(view) });
                                    },
                                    hasIcon,
                                )}
                                {stateful("icon", hasIcon, (showIcon) => demo.updatePage(current, { showIcon }))}
                                {stateful("loading", loading, (next) => demo.updatePage(current, { loading: next }))}
                                {stateful("needs-attention", attention, (next) =>
                                    demo.updatePage(current, { attention: next }),
                                )}
                                {stateful("indicator", hasIndicator, (indicator) =>
                                    demo.updatePage(current, { indicator }),
                                )}
                            </>
                        }
                    />
                </>
            }
            controllers={
                <GtkShortcutController
                    scope={Gtk.ShortcutScope.MANAGED}
                    shortcuts={shortcuts.map(({ trigger, callback }) => (
                        <GtkShortcut
                            key={trigger}
                            trigger={Gtk.ShortcutTrigger.parseString(trigger) ?? undefined}
                            action={
                                <GtkCallbackAction
                                    callback={() => {
                                        callback();
                                        return true;
                                    }}
                                />
                            }
                        />
                    ))}
                />
            }
        >
            <AdwTabOverview
                ref={(instance) => {
                    setOverview(instance);
                    instance?.setupExtraDropTarget(Gdk.DragAction.COPY, [stringType]);
                }}
                view={view ?? undefined}
                open={view !== null && open}
                onNotifyOpen={(value) => {
                    setOpen(value ?? false);
                    if (!value && view && view.getNPages() === 0) demo.closeWindow(view);
                }}
                enableNewTab
                onCreateTab={createTab}
                onExtraDragDrop={drop}
            >
                <AdwToolbarView
                    topBarStyle={Adw.ToolbarStyle.RAISED}
                    topBar={
                        <>
                            <AdwHeaderBar
                                start={
                                    <GtkButton
                                        actionName="win.window-new"
                                        iconName="window-new-symbolic"
                                        tooltipText="New Window"
                                        accessibleLabel="New Window"
                                    />
                                }
                                end={
                                    <>
                                        {view && (
                                            <AdwTabButton
                                                visible={narrow}
                                                view={view}
                                                onClicked={() => setOpen(true)}
                                            />
                                        )}
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
                                }
                            />
                            <AdwTabBar
                                visible={!narrow}
                                view={view ?? undefined}
                                ref={(bar) => bar?.setupExtraDropTarget(Gdk.DragAction.COPY, [stringType])}
                                onExtraDragDrop={drop}
                            />
                        </>
                    }
                >
                    <AdwTabView
                        ref={(instance) => {
                            viewRef.current = instance;
                            setView(instance);
                        }}
                        onCreateWindow={() => demo.createWindow(application)}
                        onClosePage={(page, self) => {
                            if (page.getPinned()) {
                                self.closePageFinish(page, false);
                            } else {
                                self.closePageFinish(page, true);
                                demo.releaseTab(page);
                            }
                            return true;
                        }}
                        onPageDetached={(_page, _position, self) => closeEmpty(self)}
                        onPageReordered={() => setOrder((value) => value + 1)}
                        onSetupMenu={(page) => setMenuPage(page)}
                        onIndicatorActivated={(page) => demo.toggleMute(page)}
                        menuModel={
                            <GMenu
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
                            />
                        }
                    />
                </AdwToolbarView>
            </AdwTabOverview>
        </AdwWindow>
    );
};

const demo = new TabDemo();

const TabViewPage = () => {
    const application = useApplication();
    return (
        <AdwToolbarView topBar={<AdwHeaderBar showTitle={false} />}>
            <AdwStatusPage
                title="Tab View"
                description="A modern tabbed browsing widget"
                iconName="widget-tab-view-symbolic"
            >
                <GtkButton
                    label="Run the Demo"
                    halign={Gtk.Align.CENTER}
                    onClicked={() => demo.createWindow(application, true)}
                />
            </AdwStatusPage>
        </AdwToolbarView>
    );
};

export { TabViewPage };
