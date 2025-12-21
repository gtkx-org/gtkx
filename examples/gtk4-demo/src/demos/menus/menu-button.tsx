import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkImage, GtkLabel, GtkMenuButton, GtkPopover, Slot } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const MenuButtonDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Menu GtkButton" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About MenuButton" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkMenuButton is a button that displays a popover or menu when clicked. It's commonly used in toolbars and header bars."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="GtkButton Styles" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12} halign={Gtk.Align.CENTER}>
                    <GtkMenuButton label="Text Only">
                        <Slot for={GtkMenuButton} id="popover">
                            <GtkPopover>
                                <Slot for={GtkPopover} id="child">
                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={4}
                                        marginStart={8}
                                        marginEnd={8}
                                        marginTop={8}
                                        marginBottom={8}
                                    >
                                        Menu content
                                    </GtkBox>
                                </Slot>
                            </GtkPopover>
                        </Slot>
                    </GtkMenuButton>

                    <GtkMenuButton iconName="open-menu-symbolic">
                        <Slot for={GtkMenuButton} id="popover">
                            <GtkPopover>
                                <Slot for={GtkPopover} id="child">
                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={4}
                                        marginStart={8}
                                        marginEnd={8}
                                        marginTop={8}
                                        marginBottom={8}
                                    >
                                        Icon menu
                                    </GtkBox>
                                </Slot>
                            </GtkPopover>
                        </Slot>
                    </GtkMenuButton>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="File Menu Example" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8} halign={Gtk.Align.CENTER}>
                    <GtkMenuButton label="File">
                        <Slot for={GtkMenuButton} id="popover">
                            <GtkPopover>
                                <Slot for={GtkPopover} id="child">
                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={2}
                                        marginStart={4}
                                        marginEnd={4}
                                        marginTop={4}
                                        marginBottom={4}
                                    >
                                        <GtkButton label="New" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <GtkButton label="Open" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <GtkButton label="Save" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <GtkButton label="Save As..." cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <GtkButton label="Close" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                    </GtkBox>
                                </Slot>
                            </GtkPopover>
                        </Slot>
                    </GtkMenuButton>

                    <GtkMenuButton label="Edit">
                        <Slot for={GtkMenuButton} id="popover">
                            <GtkPopover>
                                <Slot for={GtkPopover} id="child">
                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={2}
                                        marginStart={4}
                                        marginEnd={4}
                                        marginTop={4}
                                        marginBottom={4}
                                    >
                                        <GtkButton label="Undo" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <GtkButton label="Redo" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <GtkButton label="Cut" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <GtkButton label="Copy" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <GtkButton label="Paste" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                    </GtkBox>
                                </Slot>
                            </GtkPopover>
                        </Slot>
                    </GtkMenuButton>

                    <GtkMenuButton label="View">
                        <Slot for={GtkMenuButton} id="popover">
                            <GtkPopover>
                                <Slot for={GtkPopover} id="child">
                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={2}
                                        marginStart={4}
                                        marginEnd={4}
                                        marginTop={4}
                                        marginBottom={4}
                                    >
                                        <GtkButton label="Zoom In" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <GtkButton label="Zoom Out" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <GtkButton label="Fullscreen" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                    </GtkBox>
                                </Slot>
                            </GtkPopover>
                        </Slot>
                    </GtkMenuButton>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Rich Menu Items" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkMenuButton label="Options" halign={Gtk.Align.CENTER}>
                    <Slot for={GtkMenuButton} id="popover">
                        <GtkPopover>
                            <Slot for={GtkPopover} id="child">
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={4}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={8}
                                    marginBottom={8}
                                >
                                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                                        <GtkImage iconName="document-new-symbolic" />
                                        <GtkLabel label="New Document" halign={Gtk.Align.START} />
                                    </GtkBox>
                                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                                        <GtkImage iconName="folder-open-symbolic" />
                                        <GtkLabel label="Open Folder" halign={Gtk.Align.START} />
                                    </GtkBox>
                                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                                        <GtkImage iconName="preferences-system-symbolic" />
                                        <GtkLabel label="Settings" halign={Gtk.Align.START} />
                                    </GtkBox>
                                </GtkBox>
                            </Slot>
                        </GtkPopover>
                    </Slot>
                </GtkMenuButton>
            </GtkBox>
        </GtkBox>
    );
};

export const menuButtonDemo: Demo = {
    id: "menubutton",
    title: "Menu GtkButton",
    description: "GtkButton that shows a popover menu when clicked.",
    keywords: ["menu", "button", "popover", "dropdown", "GtkMenuButton"],
    component: MenuButtonDemo,
    sourcePath: getSourcePath(import.meta.url, "menu-button.tsx"),
};
