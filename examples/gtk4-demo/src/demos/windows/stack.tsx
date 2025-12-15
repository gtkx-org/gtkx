import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const StackDemo = () => {
    const [currentPage, setCurrentPage] = useState(0);

    const pages = [
        { label: "Page 1", content: "Content for Page 1" },
        { label: "Page 2", content: "Content for Page 2" },
        { label: "Page 3", content: "Content for Page 3" },
    ];

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="Stack" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="About Stack" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="GtkStack is a container that shows one child at a time with animated transitions. It's commonly used for multi-page interfaces like preferences dialogs or wizard flows."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Simulated Stack Navigation" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={8} halign={Gtk.Align.CENTER} marginTop={12}>
                        {pages.map((page, index) => (
                            <Button
                                // biome-ignore lint/suspicious/noArrayIndexKey: demo
                                key={index}
                                label={page.label}
                                cssClasses={currentPage === index ? ["suggested-action"] : []}
                                onClicked={() => setCurrentPage(index)}
                            />
                        ))}
                    </Box>
                    <Box
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={0}
                        heightRequest={100}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                    >
                        <Label label={pages[currentPage]?.content ?? ""} cssClasses={["title-3"]} />
                    </Box>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Transition Types" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="GtkStack supports various transition animations including: NONE, CROSSFADE, SLIDE_RIGHT, SLIDE_LEFT, SLIDE_UP, SLIDE_DOWN, and more."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Stack.Root Component" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="In GTKX, use Stack.Root with Stack.VisibleChild to define the currently visible child. The Stack component supports animated transitions between pages."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};

export const stackDemo: Demo = {
    id: "stack",
    title: "Stack",
    description: "Container showing one child at a time with transitions.",
    keywords: ["stack", "pages", "navigation", "transition", "GtkStack"],
    component: StackDemo,
    sourcePath: getSourcePath(import.meta.url, "stack.tsx"),
};
