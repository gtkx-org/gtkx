import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Image, Label, MenuButton, Popover } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const MenuButtonDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Menu Button" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About MenuButton" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GtkMenuButton is a button that displays a popover or menu when clicked. It's commonly used in toolbars and header bars."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Button Styles" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12} halign={Gtk.Align.CENTER}>
                    <MenuButton.Root label="Text Only">
                        <MenuButton.Popover>
                            <Popover.Root>
                                <Popover.Child>
                                    <Box
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={4}
                                        marginStart={8}
                                        marginEnd={8}
                                        marginTop={8}
                                        marginBottom={8}
                                    >
                                        <Label.Root label="Menu content" />
                                    </Box>
                                </Popover.Child>
                            </Popover.Root>
                        </MenuButton.Popover>
                    </MenuButton.Root>

                    <MenuButton.Root iconName="open-menu-symbolic">
                        <MenuButton.Popover>
                            <Popover.Root>
                                <Popover.Child>
                                    <Box
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={4}
                                        marginStart={8}
                                        marginEnd={8}
                                        marginTop={8}
                                        marginBottom={8}
                                    >
                                        <Label.Root label="Icon menu" />
                                    </Box>
                                </Popover.Child>
                            </Popover.Root>
                        </MenuButton.Popover>
                    </MenuButton.Root>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="File Menu Example" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={8} halign={Gtk.Align.CENTER}>
                    <MenuButton.Root label="File">
                        <MenuButton.Popover>
                            <Popover.Root>
                                <Popover.Child>
                                    <Box
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={2}
                                        marginStart={4}
                                        marginEnd={4}
                                        marginTop={4}
                                        marginBottom={4}
                                    >
                                        <Button label="New" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <Button label="Open" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <Button label="Save" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <Button label="Save As..." cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <Button label="Close" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                    </Box>
                                </Popover.Child>
                            </Popover.Root>
                        </MenuButton.Popover>
                    </MenuButton.Root>

                    <MenuButton.Root label="Edit">
                        <MenuButton.Popover>
                            <Popover.Root>
                                <Popover.Child>
                                    <Box
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={2}
                                        marginStart={4}
                                        marginEnd={4}
                                        marginTop={4}
                                        marginBottom={4}
                                    >
                                        <Button label="Undo" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <Button label="Redo" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <Button label="Cut" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <Button label="Copy" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <Button label="Paste" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                    </Box>
                                </Popover.Child>
                            </Popover.Root>
                        </MenuButton.Popover>
                    </MenuButton.Root>

                    <MenuButton.Root label="View">
                        <MenuButton.Popover>
                            <Popover.Root>
                                <Popover.Child>
                                    <Box
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={2}
                                        marginStart={4}
                                        marginEnd={4}
                                        marginTop={4}
                                        marginBottom={4}
                                    >
                                        <Button label="Zoom In" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <Button label="Zoom Out" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                        <Button label="Fullscreen" cssClasses={["flat"]} halign={Gtk.Align.FILL} />
                                    </Box>
                                </Popover.Child>
                            </Popover.Root>
                        </MenuButton.Popover>
                    </MenuButton.Root>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Rich Menu Items" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <MenuButton.Root label="Options" halign={Gtk.Align.CENTER}>
                    <MenuButton.Popover>
                        <Popover.Root>
                            <Popover.Child>
                                <Box
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={4}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={8}
                                    marginBottom={8}
                                >
                                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                                        <Image iconName="document-new-symbolic" />
                                        <Label.Root label="New Document" halign={Gtk.Align.START} />
                                    </Box>
                                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                                        <Image iconName="folder-open-symbolic" />
                                        <Label.Root label="Open Folder" halign={Gtk.Align.START} />
                                    </Box>
                                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                                        <Image iconName="preferences-system-symbolic" />
                                        <Label.Root label="Settings" halign={Gtk.Align.START} />
                                    </Box>
                                </Box>
                            </Popover.Child>
                        </Popover.Root>
                    </MenuButton.Popover>
                </MenuButton.Root>
            </Box>
        </Box>
    );
};

export const menuButtonDemo: Demo = {
    id: "menubutton",
    title: "Menu Button",
    description: "Button that shows a popover menu when clicked.",
    keywords: ["menu", "button", "popover", "dropdown", "GtkMenuButton"],
    component: MenuButtonDemo,
    sourcePath: getSourcePath(import.meta.url, "menu-button.tsx"),
};
