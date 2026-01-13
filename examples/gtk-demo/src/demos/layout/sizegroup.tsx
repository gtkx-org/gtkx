import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkGrid, GtkLabel, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./sizegroup.tsx?raw";

const SizeGroupDemo = () => {
    const [useHomogeneous, setUseHomogeneous] = useState(true);
    const [buttonWidth, setButtonWidth] = useState(100);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Size Synchronization" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="About SizeGroup" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkSizeGroup is a GTK4 utility that groups widgets so they request the same size. This is useful for aligning form labels or making dialog buttons equal width. In GTKX, you can achieve similar effects using GtkGrid, homogeneous boxes, or explicit widthRequest props."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Grid-Based Alignment" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkGrid naturally aligns columns, making all labels in a column the same effective width."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["card"]} marginTop={8} marginBottom={8}>
                    <GtkGrid
                        columnSpacing={12}
                        rowSpacing={8}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <x.GridChild column={0} row={0}>
                            <GtkLabel label="Name:" halign={Gtk.Align.END} />
                        </x.GridChild>
                        <x.GridChild column={1} row={0}>
                            <GtkEntry hexpand placeholderText="John Doe" />
                        </x.GridChild>
                        <x.GridChild column={0} row={1}>
                            <GtkLabel label="Email Address:" halign={Gtk.Align.END} />
                        </x.GridChild>
                        <x.GridChild column={1} row={1}>
                            <GtkEntry hexpand placeholderText="john@example.com" />
                        </x.GridChild>
                        <x.GridChild column={0} row={2}>
                            <GtkLabel label="Phone:" halign={Gtk.Align.END} />
                        </x.GridChild>
                        <x.GridChild column={1} row={2}>
                            <GtkEntry hexpand placeholderText="+1 234 567 8900" />
                        </x.GridChild>
                    </GtkGrid>
                </GtkBox>
                <GtkLabel
                    label="Notice how all labels in the first column are aligned to their longest member ('Email Address:')."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Homogeneous Box" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Setting homogeneous=true on a GtkBox makes all children the same size."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkButton
                    label={useHomogeneous ? "Disable Homogeneous" : "Enable Homogeneous"}
                    onClicked={() => setUseHomogeneous(!useHomogeneous)}
                    halign={Gtk.Align.START}
                />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["card"]} marginTop={8} marginBottom={8}>
                    <GtkBox
                        spacing={8}
                        homogeneous={useHomogeneous}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkButton label="OK" cssClasses={["suggested-action"]} />
                        <GtkButton label="Cancel" />
                        <GtkButton label="Apply Changes" />
                    </GtkBox>
                </GtkBox>
                <GtkLabel
                    label={
                        useHomogeneous
                            ? "All buttons have the same width (based on the widest: 'Apply Changes')."
                            : "Buttons have different widths based on their content."
                    }
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Explicit Width Request" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Use widthRequest to give multiple widgets the same explicit width."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox spacing={8}>
                    <GtkButton label="80px" onClicked={() => setButtonWidth(80)} />
                    <GtkButton label="100px" onClicked={() => setButtonWidth(100)} />
                    <GtkButton label="120px" onClicked={() => setButtonWidth(120)} />
                </GtkBox>
                <GtkLabel label={`Current width: ${buttonWidth}px`} cssClasses={["dim-label"]} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["card"]} marginTop={8} marginBottom={8}>
                    <GtkBox spacing={8} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
                        <GtkButton label="Yes" widthRequest={buttonWidth} cssClasses={["suggested-action"]} />
                        <GtkButton label="No" widthRequest={buttonWidth} />
                        <GtkButton label="Maybe" widthRequest={buttonWidth} />
                    </GtkBox>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Comparison" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Compare form layouts with and without aligned labels."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
                <GtkBox spacing={20}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["card"]} hexpand>
                        <GtkLabel label="Without Alignment" cssClasses={["heading"]} marginTop={8} />
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            marginTop={12}
                            marginBottom={12}
                            marginStart={12}
                            marginEnd={12}
                        >
                            <GtkBox spacing={8}>
                                <GtkLabel label="Name:" />
                                <GtkEntry hexpand />
                            </GtkBox>
                            <GtkBox spacing={8}>
                                <GtkLabel label="Email:" />
                                <GtkEntry hexpand />
                            </GtkBox>
                            <GtkBox spacing={8}>
                                <GtkLabel label="Address:" />
                                <GtkEntry hexpand />
                            </GtkBox>
                        </GtkBox>
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["card"]} hexpand>
                        <GtkLabel label="With Grid Alignment" cssClasses={["heading"]} marginTop={8} />
                        <GtkGrid
                            columnSpacing={8}
                            rowSpacing={8}
                            marginTop={12}
                            marginBottom={12}
                            marginStart={12}
                            marginEnd={12}
                        >
                            <x.GridChild column={0} row={0}>
                                <GtkLabel label="Name:" halign={Gtk.Align.END} />
                            </x.GridChild>
                            <x.GridChild column={1} row={0}>
                                <GtkEntry hexpand />
                            </x.GridChild>
                            <x.GridChild column={0} row={1}>
                                <GtkLabel label="Email:" halign={Gtk.Align.END} />
                            </x.GridChild>
                            <x.GridChild column={1} row={1}>
                                <GtkEntry hexpand />
                            </x.GridChild>
                            <x.GridChild column={0} row={2}>
                                <GtkLabel label="Address:" halign={Gtk.Align.END} />
                            </x.GridChild>
                            <x.GridChild column={1} row={2}>
                                <GtkEntry hexpand />
                            </x.GridChild>
                        </GtkGrid>
                    </GtkBox>
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const sizegroupDemo: Demo = {
    id: "sizegroup",
    title: "Size Synchronization",
    description: "Techniques for making widgets share the same size.",
    keywords: ["sizegroup", "size", "width", "alignment", "homogeneous", "grid"],
    component: SizeGroupDemo,
    sourceCode,
};
