import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, HeaderBar, Label, SearchEntry } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const HeaderBarDemo = () => {
    const [searchVisible, setSearchVisible] = useState(false);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="Header Bar" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Basic Header Bar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                    <HeaderBar.Root>
                        <HeaderBar.TitleWidget>
                            <Label label="Application Title" />
                        </HeaderBar.TitleWidget>
                    </HeaderBar.Root>
                    <Box
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={0}
                        heightRequest={50}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                    >
                        <Label label="Window content" cssClasses={["dim-label"]} />
                    </Box>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Header Bar with Custom Title" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                    <HeaderBar.Root showTitleButtons={false}>
                        <HeaderBar.TitleWidget>
                            <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} valign={Gtk.Align.CENTER}>
                                <Label label="My Application" cssClasses={["title"]} />
                                <Label label="Version 1.0.0" cssClasses={["subtitle"]} />
                            </Box>
                        </HeaderBar.TitleWidget>
                    </HeaderBar.Root>
                    <Box
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={0}
                        heightRequest={50}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                    >
                        <Label label="Content area" cssClasses={["dim-label"]} />
                    </Box>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Search Toggle Example" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                    <HeaderBar.Root showTitleButtons={false}>
                        <HeaderBar.TitleWidget>
                            <Label label="Document Viewer" />
                        </HeaderBar.TitleWidget>
                    </HeaderBar.Root>
                    <Box
                        orientation={Gtk.Orientation.HORIZONTAL}
                        spacing={8}
                        marginStart={8}
                        marginEnd={8}
                        marginTop={8}
                    >
                        <Button
                            label={searchVisible ? "Hide Search" : "Show Search"}
                            cssClasses={["flat"]}
                            onClicked={() => setSearchVisible((v) => !v)}
                        />
                    </Box>
                    {searchVisible && (
                        <SearchEntry
                            placeholderText="Search..."
                            marginStart={8}
                            marginEnd={8}
                            marginTop={8}
                            marginBottom={8}
                        />
                    )}
                    <Box
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={0}
                        heightRequest={50}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                    >
                        <Label label="Content" cssClasses={["dim-label"]} />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export const headerBarDemo: Demo = {
    id: "headerbar",
    title: "Header Bar",
    description: "Window header bar with title and action buttons.",
    keywords: ["header", "bar", "title", "toolbar", "GtkHeaderBar"],
    component: HeaderBarDemo,
    sourcePath: getSourcePath(import.meta.url, "header-bar.tsx"),
};
