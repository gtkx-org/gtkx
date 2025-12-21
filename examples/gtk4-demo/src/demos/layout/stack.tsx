import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkStack, GtkStackSidebar, GtkStackSwitcher, StackPage } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const StackDemo = () => {
    const [activePage, setActivePage] = useState("page1");

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Stack Container" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Stack with GtkStackSwitcher" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Stack shows one child at a time with animated transitions. Use GtkStackSwitcher for navigation."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} cssClasses={["card"]}>
                    <GtkStackSwitcher
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
                    <GtkStack
                        transitionType={Gtk.StackTransitionType.SLIDE_LEFT_RIGHT}
                        transitionDuration={200}
                        heightRequest={120}
                    >
                        <StackPage name="page1" title="First">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="First Page" cssClasses={["title-3"]} />
                                <GtkLabel label="This is the content of the first page." cssClasses={["dim-label"]} />
                            </GtkBox>
                        </StackPage>
                        <StackPage name="page2" title="Second">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="Second Page" cssClasses={["title-3"]} />
                                <GtkLabel label="This is the content of the second page." cssClasses={["dim-label"]} />
                            </GtkBox>
                        </StackPage>
                        <StackPage name="page3" title="Third">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="Third Page" cssClasses={["title-3"]} />
                                <GtkLabel label="This is the content of the third page." cssClasses={["dim-label"]} />
                            </GtkBox>
                        </StackPage>
                    </GtkStack>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Stack with GtkStackSidebar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={0} cssClasses={["card"]} heightRequest={180}>
                    <GtkStackSidebar
                        widthRequest={120}
                        ref={(sidebar: Gtk.StackSidebar | null) => {
                            if (sidebar) {
                                const stack = sidebar.getParent()?.getLastChild() as Gtk.Stack | null;
                                if (stack) sidebar.setStack(stack);
                            }
                        }}
                    />
                    <GtkStack
                        transitionType={Gtk.StackTransitionType.CROSSFADE}
                        transitionDuration={300}
                        hexpand
                        vexpand
                    >
                        <StackPage name="home" title="Home" iconName="go-home-symbolic">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="Home" cssClasses={["title-3"]} />
                                <GtkLabel label="Welcome to the home page." cssClasses={["dim-label"]} />
                            </GtkBox>
                        </StackPage>
                        <StackPage name="settings" title="Settings" iconName="emblem-system-symbolic">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="Settings" cssClasses={["title-3"]} />
                                <GtkLabel label="Configure your preferences here." cssClasses={["dim-label"]} />
                            </GtkBox>
                        </StackPage>
                        <StackPage name="about" title="About" iconName="help-about-symbolic">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="About" cssClasses={["title-3"]} />
                                <GtkLabel label="Learn more about this application." cssClasses={["dim-label"]} />
                            </GtkBox>
                        </StackPage>
                    </GtkStack>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Programmatic Control" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel label="Control the visible page with React state." wrap cssClasses={["dim-label"]} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                    <GtkButton
                        label="Page 1"
                        onClicked={() => setActivePage("page1")}
                        cssClasses={activePage === "page1" ? ["suggested-action"] : []}
                    />
                    <GtkButton
                        label="Page 2"
                        onClicked={() => setActivePage("page2")}
                        cssClasses={activePage === "page2" ? ["suggested-action"] : []}
                    />
                    <GtkButton
                        label="Page 3"
                        onClicked={() => setActivePage("page3")}
                        cssClasses={activePage === "page3" ? ["suggested-action"] : []}
                    />
                </GtkBox>
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={0} cssClasses={["card"]} heightRequest={100}>
                    <GtkStack
                        visibleChildName={activePage}
                        transitionType={Gtk.StackTransitionType.ROTATE_LEFT_RIGHT}
                        transitionDuration={400}
                        hexpand
                    >
                        <StackPage name="page1">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={0}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="Page 1" cssClasses={["title-3"]} />
                            </GtkBox>
                        </StackPage>
                        <StackPage name="page2">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={0}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="Page 2" cssClasses={["title-3"]} />
                            </GtkBox>
                        </StackPage>
                        <StackPage name="page3">
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={0}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="Page 3" cssClasses={["title-3"]} />
                            </GtkBox>
                        </StackPage>
                    </GtkStack>
                </GtkBox>
            </GtkBox>
        </GtkBox>
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
