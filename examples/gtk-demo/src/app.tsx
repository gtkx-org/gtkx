import * as path from "node:path/posix";
import { Menu } from "@gtkx/components";
import { Dialog } from "@gtkx/components/adw";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog, AdwShortcutsDialog, AdwShortcutsItem, AdwShortcutsSection } from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
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
import { useEffect, useRef, useState } from "react";
import { path as logoResourcePath } from "#data/icons/org.gtk.Demo4.svg";
import { Sidebar } from "./components/sidebar.js";
import { SourceViewer } from "./components/source-viewer.js";
import { DemoProvider, parseTitle, useDemo } from "./context/demo-context.js";
import { demos } from "./demos/index.js";
import { useLatest } from "./use-latest.js";

const applicationIconName = path.basename(logoResourcePath, path.extname(logoResourcePath));
const iconResourceDir = path.dirname(logoResourcePath);
const displaysWithIconPath = new WeakSet<Gdk.Display>();

const useApplicationIcon = (): void => {
    useEffect(() => {
        const display = Gdk.Display.getDefault();
        if (!display || displaysWithIconPath.has(display)) return;
        Gtk.IconTheme.getForDisplay(display).addResourcePath(iconResourceDir);
        displaysWithIconPath.add(display);
    }, []);
};

const InfoTab = () => {
    const { currentDemo } = useDemo();

    if (!currentDemo) {
        return (
            <GtkBox orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER} vexpand>
                <GtkLabel label="Select a demo from the sidebar" cssClasses={["dim-label"]} />
            </GtkBox>
        );
    }

    const { displayTitle } = parseTitle(currentDemo.title);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} marginTop={20} marginStart={20} marginEnd={20} marginBottom={20}>
            <GtkLabel label={displayTitle} cssClasses={["title-1"]} halign={Gtk.Align.START} />
            <GtkLabel
                label={currentDemo.description}
                cssClasses={["dim-label"]}
                halign={Gtk.Align.START}
                marginTop={6}
                wrap
            />
            {currentDemo.keywords.length > 0 && (
                <GtkBox marginTop={6} spacing={8}>
                    <GtkLabel label="Keywords:" cssClasses={["dim-label"]} />
                    <GtkLabel label={currentDemo.keywords.join(", ")} cssClasses={["dim-label"]} />
                </GtkBox>
            )}
        </GtkBox>
    );
};

interface DemoWindowProps {
    onClose: () => void;
}

const DemoWindow = ({ onClose }: DemoWindowProps) => {
    const { currentDemo, windowTitle, defaultWidget } = useDemo();
    const hostWindow = useParentWindow();
    const windowRef = useRef<Gtk.Window>(null);
    const hostWindowRef = useLatest<Gtk.Window | null>(hostWindow);

    if (!currentDemo?.component || !hostWindow) return null;

    const DemoComponent = currentDemo.component;
    const DemoTitlebar = currentDemo.titlebar;
    const DemoStateProvider = currentDemo.provider ?? (({ children }) => children);
    const { displayTitle } = parseTitle(currentDemo.title);

    if (currentDemo.dialogOnly) {
        return (
            <DemoStateProvider window={hostWindowRef} onClose={onClose}>
                <DemoComponent onClose={onClose} window={hostWindowRef} />
            </DemoStateProvider>
        );
    }

    const titlebar = DemoTitlebar ? <DemoTitlebar onClose={onClose} window={windowRef} /> : undefined;

    return (
        <DemoStateProvider window={windowRef} onClose={onClose}>
            {createPortal(
                <GtkWindow
                    ref={windowRef}
                    name="demo-window"
                    transientFor={hostWindow}
                    title={windowTitle ?? currentDemo.windowTitle ?? displayTitle}
                    defaultWidth={currentDemo.defaultWidth ?? -1}
                    defaultHeight={currentDemo.defaultHeight ?? -1}
                    resizable={currentDemo.resizable ?? true}
                    deletable={currentDemo.deletable ?? true}
                    cssClasses={currentDemo.windowCssClasses}
                    defaultWidget={defaultWidget}
                    titlebar={titlebar}
                    onCloseRequest={() => {
                        onClose();
                        return true;
                    }}
                >
                    <DemoComponent onClose={onClose} window={windowRef} />
                </GtkWindow>,
                rootElement,
            )}
        </DemoStateProvider>
    );
};

interface ShortcutsDialogProps {
    onClose: () => void;
}

const ShortcutsDialog = ({ onClose }: ShortcutsDialogProps) => (
    <Dialog>
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
    </Dialog>
);

interface AppHeaderBarProps {
    hasDemo: boolean;
    searchMode: boolean;
    onRun: () => void;
    onSearchToggle: (value: boolean) => void;
}

const AppHeaderBar = ({ hasDemo, searchMode, onRun, onSearchToggle }: AppHeaderBarProps) => (
    <GtkHeaderBar
        start={
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
                    active={searchMode}
                    onToggled={(btn: Gtk.ToggleButton) => onSearchToggle(btn.getActive())}
                    valign={Gtk.Align.CENTER}
                    focusOnClick={false}
                />
            </>
        }
        end={
            <GtkMenuButton
                name="menu-button"
                iconName="open-menu-symbolic"
                valign={Gtk.Align.CENTER}
                focusOnClick={false}
                menuModel={
                    <Menu
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
                }
            />
        }
    />
);

interface AppShortcutsProps {
    onSearchToggle: () => void;
    onKeyboardShortcuts: () => void;
    onNotebookNext: () => void;
    onNotebookPrev: () => void;
}

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
        shortcuts={
            <>
                {shortcut("<Control>f", onSearchToggle)}
                {shortcut("<Control><Shift>i", () => Gtk.Window.setInteractiveDebugging(true))}
                {shortcut("<Control>question", onKeyboardShortcuts)}
                {shortcut("<Control>Page_Down", onNotebookNext)}
                {shortcut("<Control>Page_Up", onNotebookPrev)}
            </>
        }
    />
);

interface AppNotebookProps {
    page: number;
    onSwitchPage: (page: number) => void;
}

const AppNotebook = ({ page, onSwitchPage }: AppNotebookProps) => (
    <GtkNotebook
        name="notebook"
        page={page}
        onSwitchPage={(_page, pageNum) => onSwitchPage(pageNum)}
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

interface AboutDialogProps {
    onClose: () => void;
}

const AboutDialog = ({ onClose }: AboutDialogProps) => (
    <Dialog>
        <AdwAboutDialog
            applicationName="GTK Demo"
            applicationIcon={applicationIconName}
            version="0.14.0"
            copyright="© 2026 The GTKX Team"
            website="https://gtkx.dev"
            comments="Program to demonstrate GTKX widgets"
            developerName="The GTKX Team"
            developers={["The GTKX Team"]}
            licenseType={Gtk.License.MPL_2_0}
            onClosed={onClose}
        />
    </Dialog>
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

interface MainWindowBodyProps {
    searchMode: boolean;
    notebookPage: number;
    onSearchToggle: () => void;
    onKeyboardShortcuts: () => void;
    onNotebookPageChange: (page: number) => void;
    onSearchChanged: (query: string) => void;
}

const MainWindowBody = ({
    searchMode,
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
        controllers={
            <AppShortcuts
                onSearchToggle={onSearchToggle}
                onKeyboardShortcuts={onKeyboardShortcuts}
                onNotebookNext={() => onNotebookPageChange(Math.min(notebookPage + 1, 1))}
                onNotebookPrev={() => onNotebookPageChange(Math.max(notebookPage - 1, 0))}
            />
        }
    >
        <Sidebar searchMode={searchMode} onSearchChanged={onSearchChanged} />
        <AppNotebook page={notebookPage} onSwitchPage={onNotebookPageChange} />
    </GtkBox>
);

interface MainWindowTitlebarProps {
    hasDemo: boolean;
    searchMode: boolean;
    onRun: () => void;
    onSearchToggle: (value: boolean) => void;
}

const renderMainWindowTitlebar = ({ hasDemo, searchMode, onRun, onSearchToggle }: MainWindowTitlebarProps) => (
    <AppHeaderBar hasDemo={hasDemo} searchMode={searchMode} onRun={onRun} onSearchToggle={onSearchToggle} />
);

interface MainWindowActionsProps {
    onKeyboardShortcuts: () => void;
    onShowAbout: () => void;
}

const renderMainWindowActions = ({ onKeyboardShortcuts, onShowAbout }: MainWindowActionsProps) => (
    <>
        <GSimpleAction name="inspector" onActivate={() => Gtk.Window.setInteractiveDebugging(true)} />
        <GSimpleAction name="shortcuts" onActivate={onKeyboardShortcuts} />
        <GSimpleAction name="about" onActivate={onShowAbout} />
    </>
);

const MainWindow = () => {
    const { currentDemo, setSearchQuery } = useDemo();
    const [searchMode, setSearchMode] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [notebookPage, setNotebookPage] = useState(0);
    const { demoWindows, openWindow, closeWindow } = useDemoWindows();

    const windowTitle = currentDemo ? parseTitle(currentDemo.title).displayTitle : "GTK Demo";

    const handleRun = () => {
        if (!currentDemo) return;
        openWindow();
    };

    const handleKeyboardShortcuts = () => {
        setShowShortcuts(true);
    };

    return (
        <GtkApplicationWindow
            name="main-window"
            title={windowTitle}
            defaultWidth={800}
            defaultHeight={600}
            titlebar={renderMainWindowTitlebar({
                hasDemo: !!currentDemo?.component,
                searchMode,
                onRun: handleRun,
                onSearchToggle: setSearchMode,
            })}
            onCloseRequest={quit}
            actions={renderMainWindowActions({
                onKeyboardShortcuts: handleKeyboardShortcuts,
                onShowAbout: () => setShowAbout(true),
            })}
        >
            <MainWindowBody
                searchMode={searchMode}
                notebookPage={notebookPage}
                onSearchToggle={() => setSearchMode((prev) => !prev)}
                onKeyboardShortcuts={handleKeyboardShortcuts}
                onNotebookPageChange={setNotebookPage}
                onSearchChanged={setSearchQuery}
            />
            {demoWindows.map((id) => (
                <DemoWindow key={id} onClose={() => closeWindow(id)} />
            ))}
            {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
            {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
        </GtkApplicationWindow>
    );
};

export const Demo = () => {
    useApplicationIcon();

    return (
        <DemoProvider demos={demos}>
            <MainWindow />
        </DemoProvider>
    );
};

export const App = () => (
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
