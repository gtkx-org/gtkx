import * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow, GtkBox, GtkPaned, quit, x } from "@gtkx/react";
import { DemoPanel } from "./components/demo-panel.js";
import { Sidebar } from "./components/sidebar.js";
import { SourceViewer } from "./components/source-viewer.js";
import { DemoProvider, useDemo } from "./context/demo-context.js";
import { categories } from "./demos/index.js";

const AppContent = () => {
    const { currentDemo } = useDemo();

    return (
        <GtkPaned wideHandle vexpand hexpand shrinkStartChild={false} shrinkEndChild={false} position={280}>
            <x.Slot for={GtkPaned} id="startChild">
                <Sidebar />
            </x.Slot>
            <x.Slot for={GtkPaned} id="endChild">
                <GtkPaned wideHandle vexpand hexpand shrinkStartChild={false} shrinkEndChild={false} position={550}>
                    <x.Slot for={GtkPaned} id="startChild">
                        <DemoPanel demo={currentDemo} />
                    </x.Slot>
                    <x.Slot for={GtkPaned} id="endChild">
                        <SourceViewer />
                    </x.Slot>
                </GtkPaned>
            </x.Slot>
        </GtkPaned>
    );
};

export const App = () => (
    <DemoProvider categories={categories}>
        <GtkApplicationWindow title="GTK4 Demo" defaultWidth={1400} defaultHeight={900} onClose={quit}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand hexpand>
                <AppContent />
            </GtkBox>
        </GtkApplicationWindow>
    </DemoProvider>
);

export default App;
