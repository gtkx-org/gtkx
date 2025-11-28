import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Frame, Label } from "@gtkx/gtkx";
import type { Demo } from "../types.js";

export const FramesDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Frames" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Basic Frame" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Frame.Root label="Section Title">
                    <Frame.Child>
                        <Box
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        >
                            <Label.Root label="This content is inside a frame." />
                            <Label.Root
                                label="Frames provide visual grouping with an optional label."
                                cssClasses={["dim-label"]}
                                wrap
                            />
                        </Box>
                    </Frame.Child>
                </Frame.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Frame without Label" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Frame.Root>
                    <Frame.Child>
                        <Box
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        >
                            <Label.Root label="Frames can also be used without a label." wrap />
                            <Label.Root
                                label="They still provide visual grouping and a border."
                                cssClasses={["dim-label"]}
                                wrap
                            />
                        </Box>
                    </Frame.Child>
                </Frame.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Custom Label Widget" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Frame.Root>
                    <Frame.LabelWidget>
                        <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                            <Label.Root label="Custom Header" cssClasses={["heading"]} />
                            <Button label="Action" cssClasses={["flat", "small"]} />
                        </Box>
                    </Frame.LabelWidget>
                    <Frame.Child>
                        <Box
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        >
                            <Label.Root label="You can use any widget as the frame label." wrap />
                            <Label.Root label="This allows for interactive headers." cssClasses={["dim-label"]} wrap />
                        </Box>
                    </Frame.Child>
                </Frame.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Multiple Frames" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Frame.Root label="Option A" hexpand>
                        <Frame.Child>
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={0}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={12}
                                marginBottom={12}
                            >
                                <Button label="Select A" hexpand />
                            </Box>
                        </Frame.Child>
                    </Frame.Root>
                    <Frame.Root label="Option B" hexpand>
                        <Frame.Child>
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={0}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={12}
                                marginBottom={12}
                            >
                                <Button label="Select B" hexpand />
                            </Box>
                        </Frame.Child>
                    </Frame.Root>
                    <Frame.Root label="Option C" hexpand>
                        <Frame.Child>
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={0}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={12}
                                marginBottom={12}
                            >
                                <Button label="Select C" hexpand />
                            </Box>
                        </Frame.Child>
                    </Frame.Root>
                </Box>
            </Box>
        </Box>
    );
};

export const framesDemo: Demo = {
    id: "frames",
    title: "Frames",
    description: "Decorative container with optional label for grouping widgets.",
    keywords: ["frame", "border", "group", "container", "GtkFrame"],
    component: FramesDemo,
    source: `import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Frame, Label } from "@gtkx/gtkx";

export const FramesDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20}>
            <Label.Root label="Frames" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Basic Frame" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Frame.Root label="Section Title">
                    <Frame.Child>
                        <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} margin={12}>
                            <Label.Root label="This content is inside a frame." />
                            <Label.Root label="Frames provide visual grouping with an optional label." cssClasses={["dim-label"]} wrap />
                        </Box>
                    </Frame.Child>
                </Frame.Root>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Custom Label Widget" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Frame.Root>
                    <Frame.LabelWidget>
                        <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                            <Label.Root label="Custom Header" cssClasses={["heading"]} />
                            <Button label="Action" cssClasses={["flat", "small"]} />
                        </Box>
                    </Frame.LabelWidget>
                    <Frame.Child>
                        <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} margin={12}>
                            <Label.Root label="You can use any widget as the frame label." wrap />
                        </Box>
                    </Frame.Child>
                </Frame.Root>
            </Box>
        </Box>
    );
};`,
};
