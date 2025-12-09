import * as Gtk from "@gtkx/ffi/gtk";
import { ApplicationMenu, ApplicationWindow, Box, Menu, Paned, quit } from "@gtkx/react";
import { DemoPanel } from "./components/demo-panel.js";
import { Sidebar } from "./components/sidebar.js";
import { SourceViewer } from "./components/source-viewer.js";
import { DemoProvider, useDemo } from "./context/demo-context.js";
import { categories } from "./demos/index.js";
import "./styles/global.js";

const AppContent = () => {
    const { currentDemo } = useDemo();

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
            <Paned.Root
                orientation={Gtk.Orientation.HORIZONTAL}
                wideHandle
                vexpand
                hexpand
                shrinkStartChild={false}
                shrinkEndChild={false}
                position={280}
            >
                <Paned.StartChild>
                    <Sidebar />
                </Paned.StartChild>
                <Paned.EndChild>
                    <Paned.Root
                        orientation={Gtk.Orientation.HORIZONTAL}
                        wideHandle
                        vexpand
                        hexpand
                        shrinkStartChild={false}
                        shrinkEndChild={false}
                        position={500}
                    >
                        <Paned.StartChild>
                            <DemoPanel demo={currentDemo} />
                        </Paned.StartChild>
                        <Paned.EndChild>
                            <SourceViewer sourcePath={currentDemo?.sourcePath ?? null} />
                        </Paned.EndChild>
                    </Paned.Root>
                </Paned.EndChild>
            </Paned.Root>
        </Box>
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
        <ApplicationWindow title="GTK4 Demo" defaultWidth={1400} defaultHeight={900} showMenubar onCloseRequest={quit}>
            <AppContent />
        </ApplicationWindow>
    </DemoProvider>
);

export default App;

export const appId = "org.gtkx.Demo";
