import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";

export const StackDemo = () => {
    const [currentPage, setCurrentPage] = useState(0);

    const pages = [
        { label: "Page 1", content: "Content for Page 1" },
        { label: "Page 2", content: "Content for Page 2" },
        { label: "Page 3", content: "Content for Page 3" },
    ];

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Stack" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About Stack" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GtkStack is a container that shows one child at a time with animated transitions. It's commonly used for multi-page interfaces like preferences dialogs or wizard flows."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Simulated Stack Navigation" cssClasses={["heading"]} halign={Gtk.Align.START} />
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
                        <Label.Root label={pages[currentPage]?.content ?? ""} cssClasses={["title-3"]} />
                    </Box>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Transition Types" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GtkStack supports various transition animations including: NONE, CROSSFADE, SLIDE_RIGHT, SLIDE_LEFT, SLIDE_UP, SLIDE_DOWN, and more."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Stack.Root Component" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
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
    source: `const StackDemo = () => {
    const [currentPage, setCurrentPage] = useState(0);
    const pages = ["Page 1", "Page 2", "Page 3"];

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                {pages.map((page, index) => (
                    <Button
                        key={index}
                        label={page}
                        cssClasses={currentPage === index ? ["suggested-action"] : []}
                        onClicked={() => setCurrentPage(index)}
                    />
                ))}
            </Box>
            <Stack.Root
                transitionType={Gtk.StackTransitionType.CROSSFADE}
                transitionDuration={150}
            >
                <Stack.VisibleChild>
                    <Label.Root label={pages[currentPage]} />
                </Stack.VisibleChild>
            </Stack.Root>
        </Box>
    );
};`,
};
