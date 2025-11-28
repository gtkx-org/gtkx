import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, HeaderBar, Label, SearchEntry } from "@gtkx/gtkx";
import { useState } from "react";
import type { Demo } from "../types.js";

export const HeaderBarDemo = () => {
    const [searchVisible, setSearchVisible] = useState(false);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Header Bar" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Basic Header Bar" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                    <HeaderBar.Root>
                        <HeaderBar.TitleWidget>
                            <Label.Root label="Application Title" />
                        </HeaderBar.TitleWidget>
                    </HeaderBar.Root>
                    <Box
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={0}
                        heightRequest={50}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                    >
                        <Label.Root label="Window content" cssClasses={["dim-label"]} />
                    </Box>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Header Bar with Custom Title" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                    <HeaderBar.Root showTitleButtons={false}>
                        <HeaderBar.TitleWidget>
                            <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} valign={Gtk.Align.CENTER}>
                                <Label.Root label="My Application" cssClasses={["title"]} />
                                <Label.Root label="Version 1.0.0" cssClasses={["subtitle"]} />
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
                        <Label.Root label="Content area" cssClasses={["dim-label"]} />
                    </Box>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Search Toggle Example" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                    <HeaderBar.Root showTitleButtons={false}>
                        <HeaderBar.TitleWidget>
                            <Label.Root label="Document Viewer" />
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
                        <Label.Root label="Content" cssClasses={["dim-label"]} />
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
    source: `const HeaderBarDemo = () => {
    const [searchVisible, setSearchVisible] = useState(false);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
            <HeaderBar.Root>
                <HeaderBar.TitleWidget>
                    <Label.Root label="Application Title" />
                </HeaderBar.TitleWidget>
            </HeaderBar.Root>
            <Button
                label={searchVisible ? "Hide Search" : "Show Search"}
                onClicked={() => setSearchVisible((v) => !v)}
            />
            {searchVisible && <SearchEntry placeholderText="Search..." />}
        </Box>
    );
};`,
};
