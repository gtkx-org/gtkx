import { ToastProvider } from "@gtkx/components";
import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwBreakpoint,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwSidebar,
    AdwSidebarItem,
    AdwSidebarSection,
    AdwSpinnerPaintable,
    AdwStatusPage,
    AdwToastOverlay,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GMenu, GSimpleAction } from "@gtkx/jsx/gio";
import { GtkMenuButton, GtkSearchBar, GtkSearchEntry, GtkStringFilter, GtkToggleButton } from "@gtkx/jsx/gtk";
import { quit } from "@gtkx/react";
import { getClassType } from "@gtkx/runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { DemoProvider } from "./context.js";
import { AppAboutDialog } from "./dialogs/about.js";
import { PreferencesDialog } from "./dialogs/preferences.js";
import { ShortcutsDialog } from "./dialogs/shortcuts.js";
import { pages, sections } from "./page-registry.js";
import { TabDemoWindows } from "./pages/tab-view.js";
import "./styles/demo.css";
import "./icons.js";

const collapseCondition = Adw.BreakpointCondition.parse("max-width: 500sp");

const MainWindow = ({ onClose }: { onClose: () => void }) => {
    const [window, setWindow] = useState<Adw.ApplicationWindow | null>(null);
    const [toastOverlay, setToastOverlay] = useState<Adw.ToastOverlay | null>(null);
    const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);
    const receiveToastOverlay = useCallback((overlay: Adw.ToastOverlay | null) => {
        toastOverlayRef.current = overlay;
        setToastOverlay(overlay);
    }, []);
    const [sidebar, setSidebar] = useState<Adw.Sidebar | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [showContent, setShowContent] = useState(false);
    const [searching, setSearching] = useState(false);
    const [query, setQuery] = useState("");
    const [activeId, setActiveId] = useState("welcome");
    const [dialog, setDialog] = useState<"preferences" | "shortcuts" | "about" | null>(null);
    const [preview, setPreview] = useState(false);
    const [devel, setDevel] = useState(false);
    const [expression] = useState(() => Gtk.PropertyExpression.new(getClassType(Adw.SidebarItem), null, "title"));
    const active = pages.find((page) => page.id === activeId);
    const Page = active?.component;

    return (
        <ToastProvider overlayRef={toastOverlayRef}>
            <DemoProvider toastOverlay={toastOverlay} devel={devel} setDevel={setDevel}>
                <AdwApplicationWindow
                    ref={setWindow}
                    title="Adwaita Demo (GTKX)"
                    defaultWidth={1000}
                    defaultHeight={720}
                    cssClasses={devel ? ["devel"] : []}
                    adaptivePreview={preview}
                    onNotifyAdaptivePreview={(value) => setPreview(value ?? false)}
                    onCloseRequest={() => {
                        onClose();
                        return true;
                    }}
                    breakpoints={
                        <AdwBreakpoint
                            condition={collapseCondition}
                            onApply={() => setCollapsed(true)}
                            onUnapply={() => setCollapsed(false)}
                        />
                    }
                    actions={
                        <>
                            <GSimpleAction
                                name="inspector"
                                onActivate={() => Gtk.Window.setInteractiveDebugging(true)}
                            />
                            <GSimpleAction name="adaptive-preview" onActivate={() => setPreview((value) => !value)} />
                            <GSimpleAction name="preferences" onActivate={() => setDialog("preferences")} />
                            <GSimpleAction name="shortcuts" onActivate={() => setDialog("shortcuts")} />
                            <GSimpleAction name="about" onActivate={() => setDialog("about")} />
                            <GSimpleAction name="close" onActivate={onClose} />
                        </>
                    }
                >
                    <AdwToastOverlay ref={receiveToastOverlay}>
                        <AdwNavigationSplitView
                            minSidebarWidth={220}
                            collapsed={collapsed}
                            showContent={showContent}
                            onNotifyShowContent={(value) => setShowContent(value ?? false)}
                            sidebar={
                                <AdwNavigationPage title="Adwaita Demo">
                                    <AdwToolbarView
                                        topBar={
                                            <>
                                                <AdwHeaderBar
                                                    start={
                                                        <GtkToggleButton
                                                            iconName="edit-find-symbolic"
                                                            accessibleLabel="Find pages"
                                                            active={searching}
                                                            onToggled={(button) => setSearching(button.getActive())}
                                                        />
                                                    }
                                                    end={
                                                        <GtkMenuButton
                                                            tooltipText="Main Menu"
                                                            accessibleLabel="Main Menu"
                                                            iconName="open-menu-symbolic"
                                                            primary
                                                            menuModel={
                                                                <GMenu
                                                                    items={[
                                                                        {
                                                                            section: [
                                                                                {
                                                                                    label: "_Inspector",
                                                                                    action: "win.inspector",
                                                                                },
                                                                                {
                                                                                    label: "A_daptive Preview",
                                                                                    action: "win.adaptive-preview",
                                                                                },
                                                                            ],
                                                                        },
                                                                        {
                                                                            section: [
                                                                                {
                                                                                    label: "_Preferences",
                                                                                    action: "win.preferences",
                                                                                },
                                                                                {
                                                                                    label: "_Keyboard Shortcuts",
                                                                                    action: "win.shortcuts",
                                                                                },
                                                                                {
                                                                                    label: "_About Adwaita Demo",
                                                                                    action: "win.about",
                                                                                },
                                                                            ],
                                                                        },
                                                                    ]}
                                                                />
                                                            }
                                                        />
                                                    }
                                                />
                                                <GtkSearchBar
                                                    searchModeEnabled={searching}
                                                    onNotifySearchModeEnabled={(value) => setSearching(value ?? false)}
                                                    keyCaptureWidget={window ?? undefined}
                                                >
                                                    <GtkSearchEntry
                                                        placeholderText="Find pages"
                                                        accessibleLabel="Find pages"
                                                        hexpand
                                                        text={query}
                                                        onSearchChanged={(entry) => setQuery(entry.getText())}
                                                        onActivate={() => sidebar?.grabFocus()}
                                                    />
                                                </GtkSearchBar>
                                            </>
                                        }
                                    >
                                        <AdwSidebar
                                            ref={setSidebar}
                                            selected={0}
                                            mode={collapsed ? Adw.SidebarMode.PAGE : Adw.SidebarMode.SIDEBAR}
                                            filter={<GtkStringFilter expression={expression} search={query} />}
                                            placeholder={
                                                <AdwStatusPage
                                                    iconName="edit-find-symbolic"
                                                    title="No Results Found"
                                                    description="Try a different search"
                                                />
                                            }
                                            onActivated={(index, self) => {
                                                const title = self.getItem(index)?.getTitle();
                                                const page = pages.find((candidate) => candidate.title === title);
                                                if (page) {
                                                    setActiveId(page.id);
                                                    setShowContent(true);
                                                }
                                            }}
                                        >
                                            {sections.map((section) => (
                                                <AdwSidebarSection key={section} title={section}>
                                                    {pages
                                                        .filter((page) => page.section === section)
                                                        .map((page) => (
                                                            <AdwSidebarItem
                                                                key={page.id}
                                                                title={page.title}
                                                                {...(page.id === "spinner"
                                                                    ? { iconPaintable: <AdwSpinnerPaintable /> }
                                                                    : { iconName: page.icon })}
                                                            />
                                                        ))}
                                                </AdwSidebarSection>
                                            ))}
                                        </AdwSidebar>
                                    </AdwToolbarView>
                                </AdwNavigationPage>
                            }
                        >
                            <AdwNavigationPage title={active?.title ?? ""}>
                                {Page && <Page key={activeId} />}
                            </AdwNavigationPage>
                        </AdwNavigationSplitView>
                    </AdwToastOverlay>
                    {dialog === "preferences" && <PreferencesDialog onClose={() => setDialog(null)} />}
                    {dialog === "shortcuts" && <ShortcutsDialog onClose={() => setDialog(null)} />}
                    {dialog === "about" && <AppAboutDialog onClose={() => setDialog(null)} />}
                </AdwApplicationWindow>
            </DemoProvider>
        </ToastProvider>
    );
};

const App = () => {
    const [open, setOpen] = useState(true);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    return (
        <AdwApplication
            applicationId="org.gtkx.AdwaitaDemo"
            flags={Gio.ApplicationFlags.NON_UNIQUE}
            actionAccels={[
                { detailedActionName: "win.preferences", accels: ["<Control>comma"] },
                { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
                { detailedActionName: "win.close", accels: ["<Control>w"] },
                { detailedActionName: "app.quit", accels: ["<Control>q"] },
            ]}
            actions={<GSimpleAction name="quit" onActivate={quit} />}
            onWindowRemoved={(_window, application) => {
                queueMicrotask(() => {
                    if (mounted.current && application.getWindows().length === 0) quit();
                });
            }}
        >
            {open && <MainWindow onClose={() => setOpen(false)} />}
            <TabDemoWindows />
        </AdwApplication>
    );
};

export { App };
