import * as Gtk from "@gtkx/ffi/gtk";
import { AdwPreferencesGroup, GtkBox, GtkFrame, GtkLabel, GtkMenuButton, x } from "@gtkx/react";
import { useState } from "react";

export const MenuDemo = () => {
    const [lastAction, setLastAction] = useState<string | null>(null);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginTop={24}
            marginBottom={24}
            marginStart={24}
            marginEnd={24}
        >
            <GtkLabel label="Menu Components" cssClasses={["title-1"]} halign={Gtk.Align.START} />

            {lastAction && (
                <GtkLabel label={`Last action: ${lastAction}`} cssClasses={["success"]} halign={Gtk.Align.START} />
            )}

            <AdwPreferencesGroup title="x.MenuItem" description="Clickable menu items with actions">
                <GtkFrame marginTop={12}>
                    <GtkBox marginTop={12} marginBottom={12} marginStart={12} marginEnd={12} halign={Gtk.Align.START}>
                        <GtkMenuButton label="Simple Menu" direction={Gtk.ArrowType.DOWN}>
                            <x.MenuItem id="new" label="New" onActivate={() => setLastAction("New")} />
                            <x.MenuItem id="open" label="Open" onActivate={() => setLastAction("Open")} />
                            <x.MenuItem id="save" label="Save" onActivate={() => setLastAction("Save")} />
                            <x.MenuItem id="close" label="Close" onActivate={() => setLastAction("Close")} />
                        </GtkMenuButton>
                    </GtkBox>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup title="x.MenuSection" description="Group related menu items with optional labels">
                <GtkFrame marginTop={12}>
                    <GtkBox marginTop={12} marginBottom={12} marginStart={12} marginEnd={12} halign={Gtk.Align.START}>
                        <GtkMenuButton label="Sectioned Menu" direction={Gtk.ArrowType.DOWN}>
                            <x.MenuSection label="File">
                                <x.MenuItem
                                    id="new2"
                                    label="New Document"
                                    onActivate={() => setLastAction("New Document")}
                                />
                                <x.MenuItem id="open2" label="Open..." onActivate={() => setLastAction("Open...")} />
                            </x.MenuSection>
                            <x.MenuSection label="Edit">
                                <x.MenuItem id="cut" label="Cut" onActivate={() => setLastAction("Cut")} />
                                <x.MenuItem id="copy" label="Copy" onActivate={() => setLastAction("Copy")} />
                                <x.MenuItem id="paste" label="Paste" onActivate={() => setLastAction("Paste")} />
                            </x.MenuSection>
                            <x.MenuSection>
                                <x.MenuItem id="quit" label="Quit" onActivate={() => setLastAction("Quit")} />
                            </x.MenuSection>
                        </GtkMenuButton>
                    </GtkBox>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup title="x.MenuSubmenu" description="Nested submenus for hierarchical organization">
                <GtkFrame marginTop={12}>
                    <GtkBox marginTop={12} marginBottom={12} marginStart={12} marginEnd={12} halign={Gtk.Align.START}>
                        <GtkMenuButton label="Menu with Submenus" direction={Gtk.ArrowType.DOWN}>
                            <x.MenuItem id="home" label="Home" onActivate={() => setLastAction("Home")} />
                            <x.MenuSubmenu label="Export">
                                <x.MenuItem
                                    id="pdf"
                                    label="Export as PDF"
                                    onActivate={() => setLastAction("Export as PDF")}
                                />
                                <x.MenuItem
                                    id="png"
                                    label="Export as PNG"
                                    onActivate={() => setLastAction("Export as PNG")}
                                />
                                <x.MenuItem
                                    id="svg"
                                    label="Export as SVG"
                                    onActivate={() => setLastAction("Export as SVG")}
                                />
                            </x.MenuSubmenu>
                            <x.MenuSubmenu label="Share">
                                <x.MenuItem id="email" label="Email" onActivate={() => setLastAction("Email")} />
                                <x.MenuSubmenu label="Social">
                                    <x.MenuItem
                                        id="twitter"
                                        label="Twitter"
                                        onActivate={() => setLastAction("Twitter")}
                                    />
                                    <x.MenuItem
                                        id="facebook"
                                        label="Facebook"
                                        onActivate={() => setLastAction("Facebook")}
                                    />
                                    <x.MenuItem
                                        id="linkedin"
                                        label="LinkedIn"
                                        onActivate={() => setLastAction("LinkedIn")}
                                    />
                                </x.MenuSubmenu>
                            </x.MenuSubmenu>
                            <x.MenuItem id="settings" label="Settings" onActivate={() => setLastAction("Settings")} />
                        </GtkMenuButton>
                    </GtkBox>
                </GtkFrame>
            </AdwPreferencesGroup>

            <AdwPreferencesGroup title="Keyboard Accelerators" description="Menu items with keyboard shortcuts">
                <GtkFrame marginTop={12}>
                    <GtkBox marginTop={12} marginBottom={12} marginStart={12} marginEnd={12} halign={Gtk.Align.START}>
                        <GtkMenuButton label="Menu with Shortcuts" direction={Gtk.ArrowType.DOWN}>
                            <x.MenuItem
                                id="new3"
                                label="New"
                                accels="<Control>n"
                                onActivate={() => setLastAction("New (Ctrl+N)")}
                            />
                            <x.MenuItem
                                id="open3"
                                label="Open"
                                accels="<Control>o"
                                onActivate={() => setLastAction("Open (Ctrl+O)")}
                            />
                            <x.MenuItem
                                id="save2"
                                label="Save"
                                accels="<Control>s"
                                onActivate={() => setLastAction("Save (Ctrl+S)")}
                            />
                            <x.MenuItem
                                id="saveas"
                                label="Save As"
                                accels="<Control><Shift>s"
                                onActivate={() => setLastAction("Save As (Ctrl+Shift+S)")}
                            />
                        </GtkMenuButton>
                    </GtkBox>
                </GtkFrame>
            </AdwPreferencesGroup>
        </GtkBox>
    );
};
