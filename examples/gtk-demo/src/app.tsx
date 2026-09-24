import * as Adw from "@gtkx/gi/adw";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwAboutDialog,
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwShortcutsDialog,
    AdwShortcutsItem,
    AdwShortcutsSection,
    AdwToolbarView,
    AdwViewStack,
    AdwViewStackPage,
    AdwViewSwitcher,
} from "@gtkx/jsx/adw";
import { GMenu, GSimpleAction } from "@gtkx/jsx/gio";
import {
    GtkBox,
    GtkButton,
    GtkCallbackAction,
    GtkLabel,
    GtkMenuButton,
    GtkScrolledWindow,
    GtkShortcut,
    GtkShortcutController,
    GtkShortcutTrigger,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { quit } from "@gtkx/react";
import * as path from "node:path/posix";
import { useEffect, useRef, useState } from "react";
import type { Demo as DemoDefinition } from "./demos/types.js";
import logoResourcePath from "../data/icons/org.gtk.Demo4.svg?resource";
import { DemoWindow } from "./components/demo-window.js";
import { EmptyState } from "./components/empty-state.js";
import { Sidebar } from "./components/sidebar.js";
import { SourceViewer } from "./components/source-viewer.js";
import { DemoProvider, parseTitle, useDemo } from "./context/demo-context.js";
import { demos } from "./demos/index.js";

type OpenDemoWindow = {
    id: number;
    demo: DemoDefinition;
    onClose: () => void;
};

type ShortcutsDialogProps = {
    onClose: () => void;
};

type AppHeaderBarProps = {
    hasDemo: boolean;
    isSearchActive: boolean;
    pageStack: Adw.ViewStack | null;
    onRun: () => void;
    onSearchToggle: (isActive: boolean) => void;
};

type AppShortcutsProps = {
    onSearchToggle: () => void;
    onPageNext: () => void;
    onPagePrev: () => void;
};

type AppPage = "info" | "source";

type AppPagesProps = {
    page: AppPage;
    onStackChange: (stack: Adw.ViewStack | null) => void;
    onSwitchPage: (page: AppPage) => void;
};

type AboutDialogProps = {
    onClose: () => void;
};

type MainWindowBodyProps = {
    isSearchActive: boolean;
    page: AppPage;
    onDemoActivated: (demo: DemoDefinition) => void;
    onPageChange: (page: AppPage) => void;
    onPageStackChange: (stack: Adw.ViewStack | null) => void;
    onSearchActiveChange: (isActive: boolean) => void;
    onSearchToggle: () => void;
    onSearchChanged: (query: string) => void;
};

type MainWindowActionsProps = {
    onKeyboardShortcuts: () => void;
    onShowAbout: () => void;
};

type MainWindowChrome = ReturnType<typeof useMainWindowChrome>;

type MainWindowContentProps = {
    chrome: MainWindowChrome;
    demoWindows: OpenDemoWindow[];
    onDemoActivated: (demo: DemoDefinition) => void;
    onSearchActiveChange: (isActive: boolean) => void;
    onSearchToggle: () => void;
    onSearchChanged: (query: string) => void;
};

const gtkVersion = [Gtk.getMajorVersion(), Gtk.getMinorVersion(), Gtk.getMicroVersion()].join(".");

type AppProps = {
    applicationId?: string;
};

const applicationIconName = path.basename(logoResourcePath, path.extname(logoResourcePath));
const iconResourceDir = path.dirname(logoResourcePath);
const displaysWithIconPath: WeakSet<Gdk.Display> = new WeakSet();

const useApplicationIcon = (): void => {
    useEffect(() => {
        const display = Gdk.Display.getDefault();

        if (!display || displaysWithIconPath.has(display)) {
            return;
        }

        Gtk.IconTheme.getForDisplay(display).addResourcePath(iconResourceDir);
        displaysWithIconPath.add(display);
    }, []);
};

const InfoTab = () => {
    const { currentDemo } = useDemo();

    if (!currentDemo) {
        return <EmptyState message="Select a demo from the sidebar" />;
    }

    const { displayTitle } = parseTitle(currentDemo.title);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} marginTop={20} marginStart={20} marginEnd={20} marginBottom={20}>
            <GtkLabel cssClasses={["title-1"]} halign={Gtk.Align.START}>
                {displayTitle}
            </GtkLabel>
            <GtkLabel cssClasses={["dim-label"]} halign={Gtk.Align.START} marginTop={6} wrap>
                {currentDemo.description}
            </GtkLabel>
            {currentDemo.keywords.length > 0 && (
                <GtkBox marginTop={6} spacing={8}>
                    <GtkLabel cssClasses={["dim-label"]}>Keywords:</GtkLabel>
                    <GtkLabel cssClasses={["dim-label"]}>{currentDemo.keywords.join(", ")}</GtkLabel>
                </GtkBox>
            )}
        </GtkBox>
    );
};

const ShortcutsDialog = ({ onClose }: ShortcutsDialogProps) => (
    <AdwShortcutsDialog onClosed={onClose}>
        <AdwShortcutsSection title="General">
            <AdwShortcutsItem title="Search demos" accelerator="<Control>f" />
            <AdwShortcutsItem title="Open Inspector" accelerator="<Control><Shift>i" />
            <AdwShortcutsItem title="Keyboard Shortcuts" accelerator="<Control>question" />
        </AdwShortcutsSection>
        <AdwShortcutsSection title="Navigation">
            <AdwShortcutsItem title="Next tab" accelerator="<Control>Page_Down" />
            <AdwShortcutsItem title="Previous tab" accelerator="<Control>Page_Up" />
        </AdwShortcutsSection>
    </AdwShortcutsDialog>
);

const renderPageSwitcher = (stack: Adw.ViewStack | null) => stack === null
    ? undefined
    : <AdwViewSwitcher accessibleLabel="Demo pages" policy={Adw.ViewSwitcherPolicy.WIDE} stack={stack} />;

const renderAppMenu = () => (
    <GMenu
        items={[
            {
                section: [
                    { label: "_Inspector", action: "win.inspector" },
                    { label: "_Keyboard Shortcuts", action: "win.shortcuts" },
                    { label: "_About GTK Demo", action: "win.about" },
                ],
            },
        ]}
    />
);

const AppHeaderBar = ({ hasDemo, isSearchActive, pageStack, onRun, onSearchToggle }: AppHeaderBarProps) => (
    <AdwHeaderBar
        titleWidget={renderPageSwitcher(pageStack)}
        start={(
            <>
                <GtkButton
                    label="Run"
                    onClicked={onRun}
                    sensitive={hasDemo}
                    valign={Gtk.Align.CENTER}
                    focusOnClick={false}
                />
                <GtkToggleButton
                    accessibleLabel="Search demos"
                    tooltipText="Search demos"
                    iconName="edit-find-symbolic"
                    active={isSearchActive}
                    onToggled={(button: Gtk.ToggleButton) => {
                        onSearchToggle(button.getActive());
                    }}
                    valign={Gtk.Align.CENTER}
                    focusOnClick={false}
                />
            </>
        )}
        end={(
            <GtkMenuButton
                accessibleLabel="Main Menu"
                tooltipText="Main Menu"
                iconName="open-menu-symbolic"
                valign={Gtk.Align.CENTER}
                focusOnClick={false}
                menuModel={renderAppMenu()}
            />
        )}
    />
);

const shortcut = (accelerator: string, run: () => void) => (
    <GtkShortcut
        trigger={<GtkShortcutTrigger accelerator={accelerator} />}
        action={(
            <GtkCallbackAction
                callback={() => {
                    run();

                    return true;
                }}
            />
        )}
    />
);

const AppShortcuts = ({ onSearchToggle, onPageNext, onPagePrev }: AppShortcutsProps) => (
    <GtkShortcutController
        scope={Gtk.ShortcutScope.GLOBAL}
        shortcuts={(
            <>
                {shortcut("<Control>f", onSearchToggle)}
                {shortcut("<Control>Page_Down", onPageNext)}
                {shortcut("<Control>Page_Up", onPagePrev)}
            </>
        )}
    />
);

const AppPages = ({ page, onStackChange, onSwitchPage }: AppPagesProps) => (
    <AdwViewStack
        ref={onStackChange}
        visibleChildName={page}
        onNotifyVisibleChildName={(name) => {
            if (name === "info" || name === "source") {
                onSwitchPage(name);
            }
        }}
        vexpand
        hexpand
    >
        <AdwViewStackPage name="info" title="Info" iconName="dialog-information-symbolic">
            <GtkScrolledWindow vexpand hexpand>
                <InfoTab />
            </GtkScrolledWindow>
        </AdwViewStackPage>
        <AdwViewStackPage name="source" title="Source" iconName="text-x-generic-symbolic">
            <SourceViewer />
        </AdwViewStackPage>
    </AdwViewStack>
);

const AboutDialog = ({ onClose }: AboutDialogProps) => (
    <AdwAboutDialog
        onClosed={onClose}
        applicationName="GTK Demo"
        applicationIcon={applicationIconName}
        version={gtkVersion}
        copyright="© 2026 The GTKX Team"
        website="https://gtkx.dev"
        comments="An Adwaita application demonstrating GTKX widgets"
        developerName="The GTKX Team"
        developers={["The GTKX Team"]}
        licenseType={Gtk.License.MPL_2_0}
    />
);

const useDemoWindows = () => {
    const [demoWindows, setDemoWindows] = useState<OpenDemoWindow[]>([]);
    const nextWindowId = useRef(1);

    const closeWindow = (id: number) => {
        setDemoWindows((prev) => prev.filter((window) => window.id !== id));
    };

    const openWindow = (demo: DemoDefinition) => {
        const id = nextWindowId.current;
        nextWindowId.current += 1;
        const onClose = () => {
            closeWindow(id);
        };

        setDemoWindows((prev) => [...prev, { id, demo, onClose }]);
    };

    return { demoWindows, openWindow };
};

function useMainWindowChrome() {
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [page, setPage] = useState<AppPage>("info");
    const [pageStack, setPageStack] = useState<Adw.ViewStack | null>(null);
    const [showAbout, setShowAbout] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);

    return {
        isSearchActive,
        setIsSearchActive,
        page,
        setPage,
        pageStack,
        setPageStack,
        showAbout,
        showShortcuts,

        openAbout: () => {
            setShowAbout(true);
        },

        closeAbout: () => {
            setShowAbout(false);
        },

        openShortcuts: () => {
            setShowShortcuts(true);
        },

        closeShortcuts: () => {
            setShowShortcuts(false);
        },
    };
}

const MainWindowBody = ({
    isSearchActive,
    page,
    onDemoActivated,
    onPageChange,
    onPageStackChange,
    onSearchActiveChange,
    onSearchToggle,
    onSearchChanged,
}: MainWindowBodyProps) => (
    <GtkBox
        name="main-window-body"
        vexpand
        hexpand
        controllers={(
            <AppShortcuts
                onSearchToggle={onSearchToggle}
                onPageNext={() => {
                    onPageChange("source");
                }}
                onPagePrev={() => {
                    onPageChange("info");
                }}
            />
        )}
    >
        <Sidebar
            isSearchActive={isSearchActive}
            onDemoActivated={onDemoActivated}
            onSearchActiveChange={onSearchActiveChange}
            onSearchChanged={onSearchChanged}
        />
        <AppPages page={page} onStackChange={onPageStackChange} onSwitchPage={onPageChange} />
    </GtkBox>
);

const renderMainWindowActions = ({ onKeyboardShortcuts, onShowAbout }: MainWindowActionsProps) => (
    <>
        <GSimpleAction
            name="inspector"
            onActivate={() => {
                Gtk.Window.setInteractiveDebugging(true);
            }}
        />
        <GSimpleAction name="shortcuts" onActivate={onKeyboardShortcuts} />
        <GSimpleAction name="about" onActivate={onShowAbout} />
    </>
);

const MainWindowContent = ({
    chrome,
    demoWindows,
    onDemoActivated,
    onSearchActiveChange,
    onSearchToggle,
    onSearchChanged,
}: MainWindowContentProps) => (
    <>
        <MainWindowBody
            isSearchActive={chrome.isSearchActive}
            page={chrome.page}
            onDemoActivated={onDemoActivated}
            onPageChange={chrome.setPage}
            onPageStackChange={chrome.setPageStack}
            onSearchActiveChange={onSearchActiveChange}
            onSearchToggle={onSearchToggle}
            onSearchChanged={onSearchChanged}
        />
        {demoWindows.map(({ id, demo, onClose }) => (
            <DemoProvider key={id} demos={[demo]}>
                <DemoWindow onClose={onClose} />
            </DemoProvider>
        ))}
        {chrome.showAbout && <AboutDialog onClose={chrome.closeAbout} />}
        {chrome.showShortcuts && <ShortcutsDialog onClose={chrome.closeShortcuts} />}
    </>
);

function useMainWindowSearch(chrome: MainWindowChrome, setSearchQuery: (query: string) => void) {
    const setSearchActive = (isActive: boolean) => {
        chrome.setIsSearchActive(isActive);

        if (!isActive) {
            setSearchQuery("");
        }
    };

    const toggleSearch = () => {
        setSearchActive(!chrome.isSearchActive);
    };

    return { setSearchActive, toggleSearch };
}

const MainWindow = () => {
    const { currentDemo, setSearchQuery } = useDemo();
    const chrome = useMainWindowChrome();
    const { demoWindows, openWindow } = useDemoWindows();
    const windowTitle = currentDemo ? parseTitle(currentDemo.title).displayTitle : "GTK Demo";
    const search = useMainWindowSearch(chrome, setSearchQuery);

    const handleRun = () => {
        if (!currentDemo) {
            return;
        }

        openWindow(currentDemo);
    };

    return (
        <AdwApplicationWindow
            name="main-window"
            title={windowTitle}
            defaultWidth={800}
            defaultHeight={600}
            onCloseRequest={quit}
            actions={renderMainWindowActions({
                onKeyboardShortcuts: chrome.openShortcuts,
                onShowAbout: chrome.openAbout,
            })}
        >
            <AdwToolbarView
                topBar={(
                    <AppHeaderBar
                        hasDemo={!!currentDemo?.component}
                        isSearchActive={chrome.isSearchActive}
                        pageStack={chrome.pageStack}
                        onRun={handleRun}
                        onSearchToggle={search.setSearchActive}
                    />
                )}
            >
                <MainWindowContent
                    chrome={chrome}
                    demoWindows={demoWindows}
                    onDemoActivated={openWindow}
                    onSearchActiveChange={search.setSearchActive}
                    onSearchToggle={search.toggleSearch}
                    onSearchChanged={setSearchQuery}
                />
            </AdwToolbarView>
        </AdwApplicationWindow>
    );
};

const Demo = () => {
    useApplicationIcon();

    return (
        <DemoProvider demos={demos}>
            <MainWindow />
        </DemoProvider>
    );
};

const App = ({ applicationId }: AppProps) => (
    <AdwApplication
        applicationId={applicationId}
        flags={Gio.ApplicationFlags.NON_UNIQUE}
        actionAccels={[
            { detailedActionName: "win.inspector", accels: ["<Control><Shift>i"] },
            { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
        ]}
    >
        <Demo />
    </AdwApplication>
);

export { App };
