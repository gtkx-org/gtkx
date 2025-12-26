import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkMenuButton, GtkPopover, Slot } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const PopoverDemo = () => {
    const [clicks, setClicks] = useState(0);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Popover" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About Popover" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkPopover is a bubble-like context popup. It appears relative to a parent widget and can contain any content."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Menu <GtkButton with Popover" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkMenuButton label="Open Popover" halign={Gtk.Align.CENTER}>
                    <Slot for={GtkMenuButton} id="popover">
                        <GtkPopover>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={8}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={12}
                                marginBottom={12}
                            >
                                <GtkLabel label="GtkPopover Content" cssClasses={["heading"]} />
                                <GtkLabel label="This is inside a popover!" cssClasses={["dim-label"]} />
                                <GtkButton
                                    label={`Clicked ${clicks} times`}
                                    onClicked={() => setClicks((c) => c + 1)}
                                    cssClasses={["suggested-action"]}
                                />
                            </GtkBox>
                        </GtkPopover>
                    </Slot>
                </GtkMenuButton>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Actions Menu" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkMenuButton label="Actions" iconName="view-more-symbolic" halign={Gtk.Align.CENTER}>
                    <Slot for={GtkMenuButton} id="popover">
                        <GtkPopover>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                marginStart={8}
                                marginEnd={8}
                                marginTop={8}
                                marginBottom={8}
                            >
                                <GtkButton label="New Document" cssClasses={["flat"]} />
                                <GtkButton label="Open..." cssClasses={["flat"]} />
                                <GtkButton label="Save" cssClasses={["flat"]} />
                                <GtkButton label="Save As..." cssClasses={["flat"]} />
                            </GtkBox>
                        </GtkPopover>
                    </Slot>
                </GtkMenuButton>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Popovers support custom positioning, autohide behavior, and can be triggered by any widget using MenuButton."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const popoverDemo: Demo = {
    id: "popover",
    title: "Popover",
    description: "Bubble-like context popup for additional content.",
    keywords: ["popover", "popup", "bubble", "tooltip", "GtkPopover"],
    component: PopoverDemo,
    sourcePath: getSourcePath(import.meta.url, "popover.tsx"),
};
