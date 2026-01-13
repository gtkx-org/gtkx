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
    GtkPaned,
    GtkPopover,
    GtkSearchBar,
    GtkSearchEntry,
    GtkWindow,
    quit,
    useApplication,
    x,
} from "@gtkx/react";
import { useCallback, useState } from "react";
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
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
                vexpand
                hexpand
            >
                <DemoComponent />
            </GtkBox>
        </GtkWindow>,
        activeWindow,
    );
};

const AppContent = () => {
    const { currentDemo, searchQuery, setSearchQuery } = useDemo();
    const [searchMode, setSearchMode] = useState(false);
    const [demoWindows, setDemoWindows] = useState<number[]>([]);
    const [nextWindowId, setNextWindowId] = useState(1);
    const [showAbout, setShowAbout] = useState(false);
    const app = useApplication();
    const activeWindow = app.getActiveWindow();

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
        // TODO: Implement help overlay when available
    }, []);

    const handleAbout = useCallback(() => {
        setShowAbout(true);
    }, []);

    const handleCloseAbout = useCallback(() => {
        setShowAbout(false);
    }, []);

    return (
        <>
            <GtkHeaderBar>
                <x.Slot for={GtkHeaderBar} id="titleWidget">
                    <GtkLabel label="GTK Demo" cssClasses={["title"]} />
                </x.Slot>
                <x.PackStart>
                    <GtkButton
                        label="Run"
                        cssClasses={["suggested-action"]}
                        onClicked={handleRun}
                        sensitive={!!currentDemo}
                    />
                </x.PackStart>
                <x.PackEnd>
                    <GtkMenuButton iconName="open-menu-symbolic">
                        <x.Slot for={GtkMenuButton} id="popover">
                            <GtkPopover>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                                    <GtkButton
                                        label="Inspector"
                                        cssClasses={["flat"]}
                                        onClicked={handleInspector}
                                    />
                                    <GtkButton
                                        label="Keyboard Shortcuts"
                                        cssClasses={["flat"]}
                                        onClicked={handleKeyboardShortcuts}
                                    />
                                    <GtkButton
                                        label="About GTK Demo"
                                        cssClasses={["flat"]}
                                        onClicked={handleAbout}
                                    />
                                </GtkBox>
                            </GtkPopover>
                        </x.Slot>
                    </GtkMenuButton>
                    <GtkButton
                        iconName="edit-find-symbolic"
                        cssClasses={searchMode ? ["suggested-action"] : []}
                        onClicked={() => setSearchMode(!searchMode)}
                    />
                </x.PackEnd>
            </GtkHeaderBar>

            <GtkSearchBar searchModeEnabled={searchMode}>
                <GtkSearchEntry
                    hexpand
                    placeholderText="Search demos..."
                    text={searchQuery}
                    onSearchChanged={(entry: Gtk.SearchEntry) => setSearchQuery(entry.getText())}
                />
            </GtkSearchBar>

            <GtkPaned wideHandle vexpand hexpand shrinkStartChild={false} shrinkEndChild={false} position={280}>
                <x.Slot for={GtkPaned} id="startChild">
                    <Sidebar />
                </x.Slot>
                <x.Slot for={GtkPaned} id="endChild">
                    <GtkNotebook vexpand hexpand scrollable showBorder={false}>
                        <x.NotebookPage label="Info">
                            <InfoTab />
                        </x.NotebookPage>
                        <x.NotebookPage label="Source">
                            <SourceViewer />
                        </x.NotebookPage>
                    </GtkNotebook>
                </x.Slot>
            </GtkPaned>

            {demoWindows.map((id) => (
                <DemoWindow key={id} onClose={() => handleCloseWindow(id)} />
            ))}

            {showAbout &&
                activeWindow &&
                createPortal(
                    <GtkAboutDialog
                        programName="GTK Demo"
                        version={`${Gtk.getMajorVersion()}.${Gtk.getMinorVersion()}.${Gtk.getMicroVersion()}`}
                        copyright="© 1997—2024 The GTK Team"
                        website="http://www.gtk.org"
                        comments="Program to demonstrate GTK widgets"
                        authors={["The GTK Team"]}
                        logoIconName="org.gtk.Demo4"
                        licenseType={Gtk.License.LGPL_2_1}
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
        <GtkApplicationWindow title="GTK Demo" defaultWidth={800} defaultHeight={600} onClose={quit}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand hexpand>
                <AppContent />
            </GtkBox>
        </GtkApplicationWindow>
    </DemoProvider>
);

export default App;
