import * as path from "node:path/posix";
import * as Adw from "@gtkx/gi/adw";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwAboutDialog,
    createPortal,
    GtkApplication,
    GtkApplicationWindow,
    GtkBox,
    GtkButton,
    GtkHeaderBar,
    GtkLabel,
    GtkMenuButton,
    GtkNotebook,
    GtkScrolledWindow,
    GtkShortcut,
    GtkShortcutController,
    GtkToggleButton,
    GtkWindow,
    MenuItem,
    MenuSection,
    quit,
    useApplication,
    useProperty,
} from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "./components/sidebar.js";
import { SourceViewer } from "./components/source-viewer.js";
import { DemoProvider, parseTitle, useDemo } from "./context/demo-context.js";
import { demos } from "./demos/index.js";
import { path as logoResourcePath } from "./icons/org.gtk.Demo4.svg";
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
    const app = useApplication();
    const activeWindow = useProperty(app, "activeWindow");
    const windowRef = useRef<Gtk.Window>(null);
    const activeWindowRef = useLatest<Gtk.Window | null>(activeWindow ?? null);

    if (!currentDemo?.component || !activeWindow) return null;

    const DemoComponent = currentDemo.component;
    const DemoTitlebar = currentDemo.titlebar;
    const DemoStateProvider = currentDemo.provider ?? (({ children }) => children);
    const { displayTitle } = parseTitle(currentDemo.title);

    if (currentDemo.dialogOnly) {
        return (
            <DemoStateProvider window={activeWindowRef} onClose={onClose}>
                <DemoComponent onClose={onClose} window={activeWindowRef} />
            </DemoStateProvider>
        );
    }

    const titlebar = DemoTitlebar ? <DemoTitlebar onClose={onClose} window={windowRef} /> : undefined;

    return createPortal(
        <DemoStateProvider window={windowRef} onClose={onClose}>
            <GtkWindow
                ref={windowRef}
                title={windowTitle ?? currentDemo.windowTitle ?? displayTitle}
                defaultWidth={currentDemo.defaultWidth ?? -1}
                defaultHeight={currentDemo.defaultHeight ?? -1}
                resizable={currentDemo.resizable ?? true}
                deletable={currentDemo.deletable ?? true}
                cssClasses={currentDemo.windowCssClasses}
                defaultWidget={defaultWidget}
                titlebar={titlebar}
                onClose={onClose}
            >
                <DemoComponent onClose={onClose} window={windowRef} />
            </GtkWindow>
        </DemoStateProvider>,
        activeWindow,
    );
};

const showShortcutsDialog = (activeWindow: Gtk.Window) => {
    const dialog = new Adw.ShortcutsDialog();

    const general = Adw.ShortcutsSection.new("General");
    general.add(Adw.ShortcutsItem.new("Search demos", "<Control>f"));
    general.add(Adw.ShortcutsItem.new("Open Inspector", "<Control><Shift>i"));
    general.add(Adw.ShortcutsItem.new("Keyboard Shortcuts", "<Control>question"));
    dialog.add(general);

    const navigation = Adw.ShortcutsSection.new("Navigation");
    navigation.add(Adw.ShortcutsItem.new("Next tab", "<Control>Page_Down"));
    navigation.add(Adw.ShortcutsItem.new("Previous tab", "<Control>Page_Up"));
    dialog.add(navigation);

    dialog.present(activeWindow);
};

interface AppHeaderBarProps {
    hasDemo: boolean;
    searchMode: boolean;
    onRun: () => void;
    onSearchToggle: (value: boolean) => void;
    onKeyboardShortcuts: () => void;
    onAbout: () => void;
}

const AppHeaderBar = ({
    hasDemo,
    searchMode,
    onRun,
    onSearchToggle,
    onKeyboardShortcuts,
    onAbout,
}: AppHeaderBarProps) => (
    <GtkHeaderBar
        packStart={
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
                    iconName="edit-find-symbolic"
                    active={searchMode}
                    onToggled={(btn: Gtk.ToggleButton) => onSearchToggle(btn.getActive())}
                    valign={Gtk.Align.CENTER}
                    focusOnClick={false}
                />
            </>
        }
        packEnd={
            <GtkMenuButton
                name="menu-button"
                iconName="open-menu-symbolic"
                valign={Gtk.Align.CENTER}
                focusOnClick={false}
            >
                <MenuSection>
                    <MenuItem
                        id="inspector"
                        label="_Inspector"
                        onActivate={() => Gtk.Window.setInteractiveDebugging(true)}
                        accels="<Control><Shift>i"
                    />
                    <MenuItem
                        id="shortcuts"
                        label="_Keyboard Shortcuts"
                        onActivate={onKeyboardShortcuts}
                        accels="<Control>question"
                    />
                    <MenuItem id="about" label="_About GTK Demo" onActivate={onAbout} />
                </MenuSection>
            </GtkMenuButton>
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
    <GtkShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
        {shortcut("<Control>f", onSearchToggle)}
        {shortcut("<Control><Shift>i", () => Gtk.Window.setInteractiveDebugging(true))}
        {shortcut("<Control>question", onKeyboardShortcuts)}
        {shortcut("<Control>Page_Down", onNotebookNext)}
        {shortcut("<Control>Page_Up", onNotebookPrev)}
    </GtkShortcutController>
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
        <GtkNotebook.Page>
            <GtkNotebook.PageTab>
                <GtkLabel label="_Info" useUnderline />
            </GtkNotebook.PageTab>
            <GtkScrolledWindow vexpand hexpand>
                <InfoTab />
            </GtkScrolledWindow>
        </GtkNotebook.Page>
        <GtkNotebook.Page>
            <GtkNotebook.PageTab>
                <GtkLabel label="Source" />
            </GtkNotebook.PageTab>
            <SourceViewer />
        </GtkNotebook.Page>
    </GtkNotebook>
);

interface AboutDialogProps {
    activeWindow: Gtk.Window;
    onClose: () => void;
}

const AboutDialog = ({ activeWindow, onClose }: AboutDialogProps) =>
    createPortal(
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
        />,
        activeWindow,
    );

const useDemoWindows = () => {
    const [demoWindows, setDemoWindows] = useState<number[]>([]);
    const [nextWindowId, setNextWindowId] = useState(1);

    const openWindow = useCallback(() => {
        setDemoWindows((prev) => [...prev, nextWindowId]);
        setNextWindowId((prev) => prev + 1);
    }, [nextWindowId]);

    const closeWindow = useCallback((id: number) => {
        setDemoWindows((prev) => prev.filter((w) => w !== id));
    }, []);

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
    <GtkBox name="main-window-body" vexpand hexpand>
        <AppShortcuts
            onSearchToggle={onSearchToggle}
            onKeyboardShortcuts={onKeyboardShortcuts}
            onNotebookNext={() => onNotebookPageChange(Math.min(notebookPage + 1, 1))}
            onNotebookPrev={() => onNotebookPageChange(Math.max(notebookPage - 1, 0))}
        />
        <Sidebar searchMode={searchMode} onSearchChanged={onSearchChanged} />
        <AppNotebook page={notebookPage} onSwitchPage={onNotebookPageChange} />
    </GtkBox>
);

const MainWindow = () => {
    const { currentDemo, setSearchQuery } = useDemo();
    const [searchMode, setSearchMode] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [notebookPage, setNotebookPage] = useState(0);
    const { demoWindows, openWindow, closeWindow } = useDemoWindows();
    const app = useApplication();
    const activeWindow = useProperty(app, "activeWindow");

    const windowTitle = currentDemo ? parseTitle(currentDemo.title).displayTitle : "GTK Demo";

    const handleRun = useCallback(() => {
        if (!currentDemo) return;
        openWindow();
    }, [currentDemo, openWindow]);

    const handleKeyboardShortcuts = useCallback(() => {
        if (!activeWindow) return;
        showShortcutsDialog(activeWindow);
    }, [activeWindow]);

    const titlebar = (
        <AppHeaderBar
            hasDemo={!!currentDemo?.component}
            searchMode={searchMode}
            onRun={handleRun}
            onSearchToggle={setSearchMode}
            onKeyboardShortcuts={handleKeyboardShortcuts}
            onAbout={() => setShowAbout(true)}
        />
    );

    return (
        <GtkApplicationWindow
            title={windowTitle}
            defaultWidth={800}
            defaultHeight={600}
            titlebar={titlebar}
            onClose={quit}
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
            {showAbout && activeWindow && (
                <AboutDialog activeWindow={activeWindow} onClose={() => setShowAbout(false)} />
            )}
        </GtkApplicationWindow>
    );
};

/**
 * The application's content tree: the main window and its provider, without the
 * surrounding {@link GtkApplication}. Rendered directly by tests that supply
 * their own application context.
 */
export const Demo = () => {
    useApplicationIcon();

    return (
        <DemoProvider demos={demos}>
            <MainWindow />
        </DemoProvider>
    );
};

export const App = () => (
    <GtkApplication applicationId={import.meta.env.GTKX_APPLICATION_ID} flags={Gio.ApplicationFlags.NON_UNIQUE}>
        <Demo />
    </GtkApplication>
);
