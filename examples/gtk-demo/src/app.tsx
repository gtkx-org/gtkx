import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog, AdwShortcutsDialog, AdwShortcutsItem, AdwShortcutsSection } from "@gtkx/jsx/adw";
import { GMenu, GSimpleAction } from "@gtkx/jsx/gio";
import {
    GtkApplication,
    GtkApplicationWindow,
    GtkBox,
    GtkButton,
    GtkHeaderBar,
    GtkLabel,
    GtkMenuButton,
    GtkNotebook,
    GtkNotebookPage,
    GtkScrolledWindow,
    GtkShortcut,
    GtkShortcutController,
    GtkToggleButton,
    GtkWindow,
} from "@gtkx/jsx/gtk";
import { createPortal, quit, rootElement, useParentWindow } from "@gtkx/react";
import * as path from "node:path/posix";
import { type ComponentType, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { path as logoResourcePath } from "#data/icons/org.gtk.Demo4.svg";
import type { Demo as DemoDefinition, DemoProviderProps } from "./demos/types.js";
import { Sidebar } from "./components/sidebar.js";
import { SourceViewer } from "./components/source-viewer.js";
import { DemoProvider, parseTitle, useDemo } from "./context/demo-context.js";
import { demos } from "./demos/index.js";

type DemoWindowProps = {
    onClose: () => void;
};

type DemoWindowSizing = {
    defaultWidth: number;
    defaultHeight: number;
    isResizable: boolean;
    isDeletable: boolean;
};

type ShortcutsDialogProps = {
    onClose: () => void;
};

type AppHeaderBarProps = {
    hasDemo: boolean;
    isSearchActive: boolean;
    onRun: () => void;
    onSearchToggle: (isActive: boolean) => void;
};

type AppShortcutsProps = {
    onSearchToggle: () => void;
    onKeyboardShortcuts: () => void;
    onNotebookNext: () => void;
    onNotebookPrev: () => void;
};

type AppNotebookProps = {
    page: number;
    onSwitchPage: (page: number) => void;
};

type AboutDialogProps = {
    onClose: () => void;
};

type MainWindowBodyProps = {
    isSearchActive: boolean;
    notebookPage: number;
    onSearchToggle: () => void;
    onKeyboardShortcuts: () => void;
    onNotebookPageChange: (page: number) => void;
    onSearchChanged: (query: string) => void;
};

type MainWindowActionsProps = {
    onKeyboardShortcuts: () => void;
    onShowAbout: () => void;
};

type MainWindowChrome = ReturnType<typeof useMainWindowChrome>;

type MainWindowContentProps = {
    chrome: MainWindowChrome;
    demoWindows: number[];
    onCloseWindow: (id: number) => void;
    onSearchChanged: (query: string) => void;
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
        return (
            <GtkBox orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER} vexpand>
                <GtkLabel cssClasses={["dim-label"]}>Select a demo from the sidebar</GtkLabel>
            </GtkBox>
        );
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

const PassthroughProvider: ComponentType<DemoProviderProps> = ({ children }) => children;

function demoWindowTitle(demo: DemoDefinition, windowTitle: string | null): string {
    const { displayTitle } = parseTitle(demo.title);

    return windowTitle ?? demo.windowTitle ?? displayTitle;
}

function demoWindowSizing(demo: DemoDefinition): DemoWindowSizing {
    return {
        defaultWidth: demo.defaultWidth ?? -1,
        defaultHeight: demo.defaultHeight ?? -1,
        isResizable: demo.isResizable ?? true,
        isDeletable: demo.isDeletable ?? true,
    };
}

const DemoWindow = ({ onClose }: DemoWindowProps) => {
    const { currentDemo, windowTitle, defaultWidget } = useDemo();
    const hostWindow = useParentWindow();
    const windowRef = useRef<Gtk.Window>(null);
    const hostWindowRef = useMemo<RefObject<Gtk.Window | null>>(() => ({ current: hostWindow }), [hostWindow]);

    if (!hostWindow || !currentDemo?.component) {
        return null;
    }

    const DemoComponent = currentDemo.component;
    const DemoTitlebar = currentDemo.titlebar;
    const DemoStateProvider = currentDemo.provider ?? PassthroughProvider;

    if (currentDemo.isDialogOnly) {
        return (
            <DemoStateProvider window={hostWindowRef} onClose={onClose}>
                <DemoComponent onClose={onClose} window={hostWindowRef} />
            </DemoStateProvider>
        );
    }

    const titlebar = DemoTitlebar ? <DemoTitlebar onClose={onClose} window={windowRef} /> : undefined;
    const sizing = demoWindowSizing(currentDemo);

    return (
        <DemoStateProvider window={windowRef} onClose={onClose}>
            {createPortal(
                <GtkWindow
                    ref={windowRef}
                    name="demo-window"
                    transientFor={hostWindow}
                    title={demoWindowTitle(currentDemo, windowTitle)}
                    defaultWidth={sizing.defaultWidth}
                    defaultHeight={sizing.defaultHeight}
                    resizable={sizing.isResizable}
                    deletable={sizing.isDeletable}
                    cssClasses={currentDemo.windowCssClasses}
                    defaultWidget={defaultWidget}
                    titlebar={titlebar}
                    onCloseRequest={() => {
                        onClose();

                        return Gdk.EVENT_STOP;
                    }}
                >
                    <DemoComponent onClose={onClose} window={windowRef} />
                </GtkWindow>,
                rootElement,
            )}
        </DemoStateProvider>
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

const AppHeaderBar = ({ hasDemo, isSearchActive, onRun, onSearchToggle }: AppHeaderBarProps) => (
    <GtkHeaderBar
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
                    name="search-toggle"
                    tooltipText="Search"
                    iconName="edit-find-symbolic"
                    active={isSearchActive}
                    onToggled={(btn: Gtk.ToggleButton) => {
                        onSearchToggle(btn.getActive());
                    }}
                    valign={Gtk.Align.CENTER}
                    focusOnClick={false}
                />
            </>
        )}
        end={(
            <GtkMenuButton
                name="menu-button"
                iconName="open-menu-symbolic"
                valign={Gtk.Align.CENTER}
                focusOnClick={false}
                menuModel={(
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
                )}
            />
        )}
    />
);

const shortcut = (accelerator: string, run: () => void) => (
    <GtkShortcut
        trigger={Gtk.ShortcutTrigger.parseString(accelerator)}
        action={Gtk.CallbackAction.new(() => {
            run();

            return true;
        })}
    />
);

const AppShortcuts = ({ onSearchToggle, onKeyboardShortcuts, onNotebookNext, onNotebookPrev }: AppShortcutsProps) => (
    <GtkShortcutController
        scope={Gtk.ShortcutScope.GLOBAL}
        shortcuts={(
            <>
                {shortcut("<Control>f", onSearchToggle)}
                {shortcut("<Control><Shift>i", () => {
                    Gtk.Window.setInteractiveDebugging(true);
                })}
                {shortcut("<Control>question", onKeyboardShortcuts)}
                {shortcut("<Control>Page_Down", onNotebookNext)}
                {shortcut("<Control>Page_Up", onNotebookPrev)}
            </>
        )}
    />
);

const AppNotebook = ({ page, onSwitchPage }: AppNotebookProps) => (
    <GtkNotebook
        name="notebook"
        page={page}
        onSwitchPage={(_page, pageNum) => {
            onSwitchPage(pageNum);
        }}
        vexpand
        hexpand
        scrollable
        showBorder={false}
        enablePopup
    >
        <GtkNotebookPage tabLabel="Info">
            <GtkScrolledWindow vexpand hexpand>
                <InfoTab />
            </GtkScrolledWindow>
        </GtkNotebookPage>
        <GtkNotebookPage tabLabel="Source">
            <SourceViewer />
        </GtkNotebookPage>
    </GtkNotebook>
);

const AboutDialog = ({ onClose }: AboutDialogProps) => (
    <AdwAboutDialog
        onClosed={onClose}
        applicationName="GTK Demo"
        applicationIcon={applicationIconName}
        version="0.14.0"
        copyright="© 2026 The GTKX Team"
        website="https://gtkx.dev"
        comments="Program to demonstrate GTKX widgets"
        developerName="The GTKX Team"
        developers={["The GTKX Team"]}
        licenseType={Gtk.License.MPL_2_0}
    />
);

const useDemoWindows = () => {
    const [demoWindows, setDemoWindows] = useState<number[]>([]);
    const [nextWindowId, setNextWindowId] = useState(1);

    const openWindow = () => {
        setDemoWindows((prev) => [...prev, nextWindowId]);
        setNextWindowId((prev) => prev + 1);
    };

    const closeWindow = (id: number) => {
        setDemoWindows((prev) => prev.filter((w) => w !== id));
    };

    return { demoWindows, openWindow, closeWindow };
};

function useMainWindowChrome() {
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [notebookPage, setNotebookPage] = useState(0);
    const [showAbout, setShowAbout] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);

    return {
        isSearchActive,
        setIsSearchActive,
        notebookPage,
        setNotebookPage,
        showAbout,
        showShortcuts,

        toggleSearch: () => {
            setIsSearchActive((prev) => !prev);
        },

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
    notebookPage,
    onSearchToggle,
    onKeyboardShortcuts,
    onNotebookPageChange,
    onSearchChanged,
}: MainWindowBodyProps) => (
    <GtkBox
        name="main-window-body"
        vexpand
        hexpand
        controllers={(
            <AppShortcuts
                onSearchToggle={onSearchToggle}
                onKeyboardShortcuts={onKeyboardShortcuts}
                onNotebookNext={() => {
                    onNotebookPageChange(Math.min(notebookPage + 1, 1));
                }}
                onNotebookPrev={() => {
                    onNotebookPageChange(Math.max(notebookPage - 1, 0));
                }}
            />
        )}
    >
        <Sidebar isSearchActive={isSearchActive} onSearchChanged={onSearchChanged} />
        <AppNotebook page={notebookPage} onSwitchPage={onNotebookPageChange} />
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

const MainWindowContent = ({ chrome, demoWindows, onCloseWindow, onSearchChanged }: MainWindowContentProps) => (
    <>
        <MainWindowBody
            isSearchActive={chrome.isSearchActive}
            notebookPage={chrome.notebookPage}
            onSearchToggle={chrome.toggleSearch}
            onKeyboardShortcuts={chrome.openShortcuts}
            onNotebookPageChange={chrome.setNotebookPage}
            onSearchChanged={onSearchChanged}
        />
        {demoWindows.map((id) => (
            <DemoWindow
                key={id}
                onClose={() => {
                    onCloseWindow(id);
                }}
            />
        ))}
        {chrome.showAbout && <AboutDialog onClose={chrome.closeAbout} />}
        {chrome.showShortcuts && <ShortcutsDialog onClose={chrome.closeShortcuts} />}
    </>
);

const MainWindow = () => {
    const { currentDemo, setSearchQuery } = useDemo();
    const chrome = useMainWindowChrome();
    const { demoWindows, openWindow, closeWindow } = useDemoWindows();
    const windowTitle = currentDemo ? parseTitle(currentDemo.title).displayTitle : "GTK Demo";

    const handleRun = () => {
        if (!currentDemo) {
            return;
        }

        openWindow();
    };

    return (
        <GtkApplicationWindow
            name="main-window"
            title={windowTitle}
            defaultWidth={800}
            defaultHeight={600}
            titlebar={(
                <AppHeaderBar
                    hasDemo={!!currentDemo?.component}
                    isSearchActive={chrome.isSearchActive}
                    onRun={handleRun}
                    onSearchToggle={chrome.setIsSearchActive}
                />
            )}
            onCloseRequest={quit}
            actions={renderMainWindowActions({
                onKeyboardShortcuts: chrome.openShortcuts,
                onShowAbout: chrome.openAbout,
            })}
        >
            <MainWindowContent
                chrome={chrome}
                demoWindows={demoWindows}
                onCloseWindow={closeWindow}
                onSearchChanged={setSearchQuery}
            />
        </GtkApplicationWindow>
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

const App = () => (
    <GtkApplication
        flags={Gio.ApplicationFlags.NON_UNIQUE}
        actionAccels={[
            { detailedActionName: "win.inspector", accels: ["<Control><Shift>i"] },
            { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
        ]}
    >
        <Demo />
    </GtkApplication>
);

export { App, Demo };
