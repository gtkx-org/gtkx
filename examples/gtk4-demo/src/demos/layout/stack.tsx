import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label, Stack, StackSidebar, StackSwitcher } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const StackDemo = () => {
    const [activePage, setActivePage] = useState("page1");

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="Stack Container" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Stack with StackSwitcher" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="Stack shows one child at a time with animated transitions. Use StackSwitcher for navigation."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} cssClasses={["card"]}>
                    <StackSwitcher.Root
                        marginTop={8}
                        marginStart={8}
                        marginEnd={8}
                        ref={(switcher: Gtk.StackSwitcher | null) => {
                            if (switcher) {
                                const stack = switcher.getParent()?.getLastChild() as Gtk.Stack | null;
                                if (stack) switcher.setStack(stack);
                            }
                        }}
                    />
                    <Stack.Root
                        transitionType={Gtk.StackTransitionType.SLIDE_LEFT_RIGHT}
                        transitionDuration={200}
                        heightRequest={120}
                    >
                        <Stack.Page name="page1" title="First">
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <Label label="First Page" cssClasses={["title-3"]} />
                                <Label label="This is the content of the first page." cssClasses={["dim-label"]} />
                            </Box>
                        </Stack.Page>
                        <Stack.Page name="page2" title="Second">
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <Label label="Second Page" cssClasses={["title-3"]} />
                                <Label label="This is the content of the second page." cssClasses={["dim-label"]} />
                            </Box>
                        </Stack.Page>
                        <Stack.Page name="page3" title="Third">
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <Label label="Third Page" cssClasses={["title-3"]} />
                                <Label label="This is the content of the third page." cssClasses={["dim-label"]} />
                            </Box>
                        </Stack.Page>
                    </Stack.Root>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Stack with StackSidebar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={0} cssClasses={["card"]} heightRequest={180}>
                    <StackSidebar.Root
                        widthRequest={120}
                        ref={(sidebar: Gtk.StackSidebar | null) => {
                            if (sidebar) {
                                const stack = sidebar.getParent()?.getLastChild() as Gtk.Stack | null;
                                if (stack) sidebar.setStack(stack);
                            }
                        }}
                    />
                    <Stack.Root
                        transitionType={Gtk.StackTransitionType.CROSSFADE}
                        transitionDuration={300}
                        hexpand
                        vexpand
                    >
                        <Stack.Page name="home" title="Home" iconName="go-home-symbolic">
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <Label label="Home" cssClasses={["title-3"]} />
                                <Label label="Welcome to the home page." cssClasses={["dim-label"]} />
                            </Box>
                        </Stack.Page>
                        <Stack.Page name="settings" title="Settings" iconName="emblem-system-symbolic">
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <Label label="Settings" cssClasses={["title-3"]} />
                                <Label label="Configure your preferences here." cssClasses={["dim-label"]} />
                            </Box>
                        </Stack.Page>
                        <Stack.Page name="about" title="About" iconName="help-about-symbolic">
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <Label label="About" cssClasses={["title-3"]} />
                                <Label label="Learn more about this application." cssClasses={["dim-label"]} />
                            </Box>
                        </Stack.Page>
                    </Stack.Root>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Programmatic Control" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label label="Control the visible page with React state." wrap cssClasses={["dim-label"]} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                    <Button
                        label="Page 1"
                        onClicked={() => setActivePage("page1")}
                        cssClasses={activePage === "page1" ? ["suggested-action"] : []}
                    />
                    <Button
                        label="Page 2"
                        onClicked={() => setActivePage("page2")}
                        cssClasses={activePage === "page2" ? ["suggested-action"] : []}
                    />
                    <Button
                        label="Page 3"
                        onClicked={() => setActivePage("page3")}
                        cssClasses={activePage === "page3" ? ["suggested-action"] : []}
                    />
                </Box>
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={0} cssClasses={["card"]} heightRequest={100}>
                    <Stack.Root
                        visibleChildName={activePage}
                        transitionType={Gtk.StackTransitionType.ROTATE_LEFT_RIGHT}
                        transitionDuration={400}
                        hexpand
                    >
                        <Stack.Page name="page1">
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={0}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <Label label="Page 1" cssClasses={["title-3"]} />
                            </Box>
                        </Stack.Page>
                        <Stack.Page name="page2">
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={0}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <Label label="Page 2" cssClasses={["title-3"]} />
                            </Box>
                        </Stack.Page>
                        <Stack.Page name="page3">
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={0}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <Label label="Page 3" cssClasses={["title-3"]} />
                            </Box>
                        </Stack.Page>
                    </Stack.Root>
                </Box>
            </Box>
        </Box>
    );
};

export const stackDemo: Demo = {
    id: "stack",
    title: "Stack",
    description: "Shows one child at a time with animated transitions.",
    keywords: ["stack", "switcher", "sidebar", "pages", "transitions", "GtkStack"],
    component: StackDemo,
    sourcePath: getSourcePath(import.meta.url, "stack.tsx"),
};
