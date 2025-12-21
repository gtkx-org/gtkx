import * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow, GtkBox, GtkPaned, Menu, quit, Slot } from "@gtkx/react";
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
            <GtkPaned
                orientation={Gtk.Orientation.HORIZONTAL}
                wideHandle
                vexpand
                hexpand
                shrinkStartChild={false}
                shrinkEndChild={false}
                position={280}
            >
                <Slot for={GtkPaned} id="startChild">
                    <Sidebar />
                </Slot>
                <Slot for={GtkPaned} id="endChild">
                    <GtkPaned
                        orientation={Gtk.Orientation.HORIZONTAL}
                        wideHandle
                        vexpand
                        hexpand
                        shrinkStartChild={false}
                        shrinkEndChild={false}
                        position={500}
                    >
                        <Slot for={GtkPaned} id="startChild">
                            <DemoPanel demo={currentDemo} />
                        </Slot>
                        <Slot for={GtkPaned} id="endChild">
                            <SourceViewer sourcePath={currentDemo?.sourcePath ?? null} />
                        </Slot>
                    </GtkPaned>
                </Slot>
            </GtkPaned>
        </GtkBox>
    );
};

export const App = () => (
    <DemoProvider categories={categories}>
        <Menu.Submenu label="File">
            <Menu.Item
                id="new"
                label="New Document"
                onActivate={() => console.log("New Document")}
                accels="<Control>n"
            />
            <Menu.Item id="open" label="Open..." onActivate={() => console.log("Open")} accels="<Control>o" />
            <Menu.Item id="save" label="Save" onActivate={() => console.log("Save")} accels="<Control>s" />
            <Menu.Section>
                <Menu.Item id="quit" label="Quit" onActivate={quit} accels="<Control>q" />
            </Menu.Section>
        </Menu.Submenu>
        <Menu.Submenu label="Edit">
            <Menu.Item id="undo" label="Undo" onActivate={() => console.log("Undo")} accels="<Control>z" />
            <Menu.Item id="redo" label="Redo" onActivate={() => console.log("Redo")} accels="<Control><Shift>z" />
            <Menu.Section>
                <Menu.Item id="cut" label="Cut" onActivate={() => console.log("Cut")} accels="<Control>x" />
                <Menu.Item id="copy" label="Copy" onActivate={() => console.log("Copy")} accels="<Control>c" />
                <Menu.Item id="paste" label="Paste" onActivate={() => console.log("Paste")} accels="<Control>v" />
            </Menu.Section>
        </Menu.Submenu>
        <Menu.Submenu label="Help">
            <Menu.Item
                id="documentation"
                label="Documentation"
                onActivate={() => console.log("Documentation")}
                accels="F1"
            />
            <Menu.Item id="about" label="About" onActivate={() => console.log("About")} />
        </Menu.Submenu>
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
