import * as Gtk from "@gtkx/ffi/gtk";
import { ApplicationMenu, GtkApplicationWindow, GtkBox, GtkPaned, Menu, quit } from "@gtkx/react";
import { DemoPanel } from "./components/demo-panel.js";
import { Sidebar } from "./components/sidebar.js";
import { SourceViewer } from "./components/source-viewer.js";
import { DemoProvider, useDemo } from "./context/demo-context.js";
import { categories } from "./demos/index.js";
import "./styles/global.js";

const AppContent = () => {
    const { currentDemo } = useDemo();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
            <GtkPaned.Root
                orientation={Gtk.Orientation.HORIZONTAL}
                wideHandle
                vexpand
                hexpand
                shrinkStartChild={false}
                shrinkEndChild={false}
                position={280}
            >
                <GtkPaned.StartChild>
                    <Sidebar />
                </GtkPaned.StartChild>
                <GtkPaned.EndChild>
                    <GtkPaned.Root
                        orientation={Gtk.Orientation.HORIZONTAL}
                        wideHandle
                        vexpand
                        hexpand
                        shrinkStartChild={false}
                        shrinkEndChild={false}
                        position={500}
                    >
                        <GtkPaned.StartChild>
                            <DemoPanel demo={currentDemo} />
                        </GtkPaned.StartChild>
                        <GtkPaned.EndChild>
                            <SourceViewer sourcePath={currentDemo?.sourcePath ?? null} />
                        </GtkPaned.EndChild>
                    </GtkPaned.Root>
                </GtkPaned.EndChild>
            </GtkPaned.Root>
        </GtkBox>
    );
};

export const App = () => (
    <DemoProvider categories={categories}>
        <ApplicationMenu>
            <Menu.Submenu label="File">
                <Menu.Item label="New Document" onActivate={() => console.log("New Document")} accels="<Control>n" />
                <Menu.Item label="Open..." onActivate={() => console.log("Open")} accels="<Control>o" />
                <Menu.Item label="Save" onActivate={() => console.log("Save")} accels="<Control>s" />
                <Menu.Section>
                    <Menu.Item label="Quit" onActivate={quit} accels="<Control>q" />
                </Menu.Section>
            </Menu.Submenu>
            <Menu.Submenu label="Edit">
                <Menu.Item label="Undo" onActivate={() => console.log("Undo")} accels="<Control>z" />
                <Menu.Item label="Redo" onActivate={() => console.log("Redo")} accels="<Control><Shift>z" />
                <Menu.Section>
                    <Menu.Item label="Cut" onActivate={() => console.log("Cut")} accels="<Control>x" />
                    <Menu.Item label="Copy" onActivate={() => console.log("Copy")} accels="<Control>c" />
                    <Menu.Item label="Paste" onActivate={() => console.log("Paste")} accels="<Control>v" />
                </Menu.Section>
            </Menu.Submenu>
            <Menu.Submenu label="Help">
                <Menu.Item label="Documentation" onActivate={() => console.log("Documentation")} accels="F1" />
                <Menu.Item label="About" onActivate={() => console.log("About")} />
            </Menu.Submenu>
        </ApplicationMenu>
        <GtkApplicationWindow
            title="GTK4 Demo"
            defaultWidth={1400}
            defaultHeight={900}
            showMenubar
            onCloseRequest={quit}
        >
            <AppContent />
        </GtkApplicationWindow>
    </DemoProvider>
);

export default App;

export const appId = "org.gtkx.Demo";
