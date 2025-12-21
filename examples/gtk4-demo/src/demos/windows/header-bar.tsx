import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkHeaderBar, GtkLabel, GtkSearchEntry } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const HeaderBarDemo = () => {
    const [searchVisible, setSearchVisible] = useState(false);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Header Bar" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Basic Header Bar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                    <GtkHeaderBar.Root>
                        <GtkHeaderBar.TitleWidget>Application Title</GtkHeaderBar.TitleWidget>
                    </GtkHeaderBar.Root>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={0}
                        heightRequest={50}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                    >
                        <GtkLabel label="<GtkWindow content" cssClasses={["dim-label"]} />
                    </GtkBox>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Header Bar with Custom Title" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                    <GtkHeaderBar.Root showTitleButtons={false}>
                        <GtkHeaderBar.TitleWidget>
                            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} valign={Gtk.Align.CENTER}>
                                <GtkLabel label="My Application" cssClasses={["title"]} />
                                <GtkLabel label="Version 1.0.0" cssClasses={["subtitle"]} />
                            </GtkBox>
                        </GtkHeaderBar.TitleWidget>
                    </GtkHeaderBar.Root>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={0}
                        heightRequest={50}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                    >
                        <GtkLabel label="Content area" cssClasses={["dim-label"]} />
                    </GtkBox>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Search Toggle Example" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                    <GtkHeaderBar.Root showTitleButtons={false}>
                        <GtkHeaderBar.TitleWidget>Document Viewer</GtkHeaderBar.TitleWidget>
                    </GtkHeaderBar.Root>
                    <GtkBox
                        orientation={Gtk.Orientation.HORIZONTAL}
                        spacing={8}
                        marginStart={8}
                        marginEnd={8}
                        marginTop={8}
                    >
                        <GtkButton
                            label={searchVisible ? "Hide Search" : "Show Search"}
                            cssClasses={["flat"]}
                            onClicked={() => setSearchVisible((v) => !v)}
                        />
                    </GtkBox>
                    {searchVisible && (
                        <GtkSearchEntry
                            placeholderText="Search..."
                            marginStart={8}
                            marginEnd={8}
                            marginTop={8}
                            marginBottom={8}
                        />
                    )}
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={0}
                        heightRequest={50}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                    >
                        <GtkLabel label="Content" cssClasses={["dim-label"]} />
                    </GtkBox>
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const headerBarDemo: Demo = {
    id: "headerbar",
    title: "Header Bar",
    description: "<GtkWindow header bar with title and action buttons.",
    keywords: ["header", "bar", "title", "toolbar", "GtkHeaderBar"],
    component: HeaderBarDemo,
    sourcePath: getSourcePath(import.meta.url, "header-bar.tsx"),
};
