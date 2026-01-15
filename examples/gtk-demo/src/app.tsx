import path from "node:path";
import * as Adw from "@gtkx/ffi/adw";
import * as Gdk from "@gtkx/ffi/gdk";
import * as GdkPixbuf from "@gtkx/ffi/gdkpixbuf";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    createPortal,
    GtkAboutDialog,
    GtkApplicationWindow,
    GtkBox,
    GtkButton,
    GtkHeaderBar,
    GtkLabel,
    GtkMenuButton,
    GtkNotebook,
    GtkScrolledWindow,
    GtkToggleButton,
    GtkWindow,
    quit,
    useApplication,
    x,
} from "@gtkx/react";
import { useCallback, useMemo, useState } from "react";
import { Sidebar } from "./components/sidebar.js";
import { SourceViewer } from "./components/source-viewer.js";
import { DemoProvider, useDemo } from "./context/demo-context.js";
import { categories } from "./demos/index.js";

const InfoTab = () => {
    const { currentDemo } = useDemo();

    if (!currentDemo) {
        return (
            <GtkBox orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER} vexpand>
                <GtkLabel label="Select a demo from the sidebar" cssClasses={["dim-label"]} />
            </GtkBox>
        );
    }

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} marginTop={24} marginStart={24} marginEnd={24} marginBottom={24}>
            <GtkLabel label={currentDemo.title} cssClasses={["title-1"]} halign={Gtk.Align.START} />
            <GtkLabel
                label={currentDemo.description}
                cssClasses={["dim-label"]}
                halign={Gtk.Align.START}
                marginTop={8}
                wrap
            />
            {currentDemo.keywords.length > 0 && (
                <GtkBox marginTop={16} spacing={8}>
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
    const { currentDemo } = useDemo();
    const app = useApplication();
    const activeWindow = app.getActiveWindow();

    if (!currentDemo || !activeWindow) return null;

    const DemoComponent = currentDemo.component;

    return createPortal(
        <GtkWindow title={currentDemo.title} defaultWidth={800} defaultHeight={600} onClose={onClose}>
            <GtkScrolledWindow vexpand hexpand>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <DemoComponent />
                </GtkBox>
            </GtkScrolledWindow>
        </GtkWindow>,
        activeWindow,
    );
};

const AppContent = () => {
    const { currentDemo, setSearchQuery } = useDemo();
    const [searchMode, setSearchMode] = useState(false);
    const [demoWindows, setDemoWindows] = useState<number[]>([]);
    const [nextWindowId, setNextWindowId] = useState(1);
    const [showAbout, setShowAbout] = useState(false);
    const [notebookPage, setNotebookPage] = useState(0);
    const app = useApplication();
    const activeWindow = app.getActiveWindow();

    const gtkxLogo = useMemo(() => {
        const logoPath = path.resolve(import.meta.dirname, "../../..", "logo.svg");
        const pixbuf = GdkPixbuf.Pixbuf.newFromFileAtScale(logoPath, 64, 64, true);
        return new Gdk.Texture(pixbuf);
    }, []);

    const handleRun = useCallback(() => {
        if (!currentDemo) return;
        setDemoWindows((prev) => [...prev, nextWindowId]);
        setNextWindowId((prev) => prev + 1);
    }, [currentDemo, nextWindowId]);

    const handleCloseWindow = useCallback((id: number) => {
        setDemoWindows((prev) => prev.filter((w) => w !== id));
    }, []);

    const handleInspector = useCallback(() => {
        Gtk.Window.setInteractiveDebugging(true);
    }, []);

    const handleKeyboardShortcuts = useCallback(() => {
        const window = app.getActiveWindow();
        if (!window) return;

        const dialog = new Adw.ShortcutsDialog();

        const general = new Adw.ShortcutsSection("General");
        general.add(new Adw.ShortcutsItem("Search demos", "<Control>f"));
        general.add(new Adw.ShortcutsItem("Open Inspector", "<Control><Shift>i"));
        general.add(new Adw.ShortcutsItem("Keyboard Shortcuts", "<Control>question"));
        dialog.add(general);

        const navigation = new Adw.ShortcutsSection("Navigation");
        navigation.add(new Adw.ShortcutsItem("Next tab", "<Control>Page_Down"));
        navigation.add(new Adw.ShortcutsItem("Previous tab", "<Control>Page_Up"));
        dialog.add(navigation);

        dialog.present(window);
    }, [app]);

    const handleAbout = useCallback(() => {
        setShowAbout(true);
    }, []);

    const handleCloseAbout = useCallback(() => {
        setShowAbout(false);
    }, []);

    const windowTitle = currentDemo?.title ?? "GTKX Demo";

    return (
        <>
            <x.Slot for={GtkWindow} id="titlebar">
                <GtkHeaderBar>
                    <x.Slot for={GtkHeaderBar} id="titleWidget">
                        <GtkLabel label={windowTitle} cssClasses={["title"]} />
                    </x.Slot>
                    <x.PackStart>
                        <GtkButton
                            label="Run"
                            onClicked={handleRun}
                            sensitive={!!currentDemo}
                            valign={Gtk.Align.CENTER}
                            focusOnClick={false}
                        />
                        <GtkToggleButton
                            iconName="edit-find-symbolic"
                            active={searchMode}
                            onToggled={(btn: Gtk.ToggleButton) => setSearchMode(btn.getActive())}
                            valign={Gtk.Align.CENTER}
                            focusOnClick={false}
                        />
                    </x.PackStart>
                    <x.PackEnd>
                        <GtkMenuButton iconName="open-menu-symbolic" valign={Gtk.Align.CENTER} focusOnClick={false}>
                            <x.MenuSection>
                                <x.MenuItem
                                    id="inspector"
                                    label="_Inspector"
                                    onActivate={handleInspector}
                                    accels="<Control><Shift>i"
                                />
                                <x.MenuItem
                                    id="shortcuts"
                                    label="_Keyboard Shortcuts"
                                    onActivate={handleKeyboardShortcuts}
                                    accels="<Control>question"
                                />
                                <x.MenuItem id="about" label="_About GTKX Demo" onActivate={handleAbout} />
                            </x.MenuSection>
                        </GtkMenuButton>
                    </x.PackEnd>
                </GtkHeaderBar>
            </x.Slot>

            <GtkBox vexpand hexpand>
                <x.ShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
                    <x.Shortcut trigger="<Control>f" onActivate={() => setSearchMode((prev) => !prev)} />
                    <x.Shortcut
                        trigger="<Control><Shift>i"
                        onActivate={() => Gtk.Window.setInteractiveDebugging(true)}
                    />
                    <x.Shortcut trigger="<Control>question" onActivate={handleKeyboardShortcuts} />
                    <x.Shortcut
                        trigger="<Control>Page_Down"
                        onActivate={() => setNotebookPage((prev) => Math.min(prev + 1, 1))}
                    />
                    <x.Shortcut
                        trigger="<Control>Page_Up"
                        onActivate={() => setNotebookPage((prev) => Math.max(prev - 1, 0))}
                    />
                </x.ShortcutController>

                <Sidebar searchMode={searchMode} onSearchChanged={setSearchQuery} />

                <GtkNotebook
                    page={notebookPage}
                    onSwitchPage={(_, __, pageNum) => setNotebookPage(pageNum)}
                    vexpand
                    hexpand
                    scrollable
                    showBorder={false}
                    enablePopup
                >
                    <x.NotebookPage tabExpand>
                        <x.NotebookPageTab>
                            <GtkLabel label="_Info" useUnderline />
                        </x.NotebookPageTab>
                        <GtkScrolledWindow vexpand hexpand>
                            <InfoTab />
                        </GtkScrolledWindow>
                    </x.NotebookPage>
                    <x.NotebookPage tabExpand>
                        <x.NotebookPageTab>
                            <GtkLabel label="Source" />
                        </x.NotebookPageTab>
                        <SourceViewer />
                    </x.NotebookPage>
                </GtkNotebook>
            </GtkBox>

            {demoWindows.map((id) => (
                <DemoWindow key={id} onClose={() => handleCloseWindow(id)} />
            ))}

            {showAbout &&
                activeWindow &&
                createPortal(
                    <GtkAboutDialog
                        programName="GTKX Demo"
                        version="0.14.0"
                        copyright="© 2026 The GTKX Team"
                        website="https://gtkx.dev"
                        comments="Program to demonstrate GTKX widgets"
                        authors={["The GTKX Team"]}
                        logo={gtkxLogo}
                        licenseType={Gtk.License.MIT_X11}
                        wrapLicense
                        onClose={handleCloseAbout}
                    />,
                    activeWindow,
                )}
        </>
    );
};

export const App = () => (
    <DemoProvider categories={categories}>
        <GtkApplicationWindow title="GTKX Demo" defaultWidth={800} defaultHeight={600} onClose={quit}>
            <AppContent />
        </GtkApplicationWindow>
    </DemoProvider>
);

export default App;
