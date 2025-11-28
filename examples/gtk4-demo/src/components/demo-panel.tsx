import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Frame, Label, ScrolledWindow } from "@gtkx/gtkx";
import type { Demo } from "../demos/types.js";

interface DemoPanelProps {
    demo: Demo | null;
}

export const DemoPanel = ({ demo }: DemoPanelProps) => {
    if (!demo) {
        return (
            <Box
                orientation={Gtk.Orientation.VERTICAL}
                spacing={0}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                vexpand
                hexpand
            >
                <Label.Root label="Select a demo from the sidebar" cssClasses={["dim-label"]} />
            </Box>
        );
    }

    const DemoComponent = demo.component;

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
            <Box
                orientation={Gtk.Orientation.VERTICAL}
                spacing={0}
                marginStart={16}
                marginEnd={16}
                marginTop={16}
                marginBottom={8}
            >
                <Label.Root label={demo.title} cssClasses={["title-1"]} halign={Gtk.Align.START} />
                <Label.Root
                    label={demo.description}
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                    marginTop={4}
                    wrap
                />
            </Box>
            <ScrolledWindow vexpand hexpand>
                <Frame.Root marginStart={16} marginEnd={16} marginTop={8} marginBottom={16}>
                    <Frame.Child>
                        <Box
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={0}
                            marginStart={16}
                            marginEnd={16}
                            marginTop={16}
                            marginBottom={16}
                        >
                            <DemoComponent />
                        </Box>
                    </Frame.Child>
                </Frame.Root>
            </ScrolledWindow>
        </Box>
    );
};
