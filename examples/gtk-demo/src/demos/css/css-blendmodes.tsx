import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkGrid,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkScrolledWindow,
    GtkStack,
    GtkStackSwitcher,
    x,
} from "@gtkx/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Demo } from "../types.js";
import blendsPath from "./blends.png";
import cmyPath from "./cmy.jpg";
import sourceCode from "./css-blendmodes.tsx?raw";
import duckyPath from "./ducky.png";

const BLEND_MODES = [
    { name: "Color", id: "color" },
    { name: "Color (burn)", id: "color-burn" },
    { name: "Color (dodge)", id: "color-dodge" },
    { name: "Darken", id: "darken" },
    { name: "Difference", id: "difference" },
    { name: "Exclusion", id: "exclusion" },
    { name: "Hard Light", id: "hard-light" },
    { name: "Hue", id: "hue" },
    { name: "Lighten", id: "lighten" },
    { name: "Luminosity", id: "luminosity" },
    { name: "Multiply", id: "multiply" },
    { name: "Normal", id: "normal" },
    { name: "Overlay", id: "overlay" },
    { name: "Saturate", id: "saturation" },
    { name: "Screen", id: "screen" },
    { name: "Soft Light", id: "soft-light" },
];

function createBlendCss(blendMode: string) {
    return css`
        & image.duck {
            background-image: url("file://${duckyPath}");
            background-size: cover;
            min-width: 200px;
            min-height: 200px;
        }

        & image.gradient {
            background-image: linear-gradient(to right, red 0%, green 50%, blue 100%);
            min-width: 200px;
            min-height: 200px;
        }

        & image.red {
            background: url("file://${blendsPath}") top center;
            min-width: 200px;
            min-height: 200px;
        }

        & image.blue {
            background: url("file://${blendsPath}") bottom center;
            min-width: 200px;
            min-height: 200px;
        }

        & image.cyan {
            background: url("file://${cmyPath}") top center;
            min-width: 200px;
            min-height: 200px;
        }

        & image.magenta {
            background: url("file://${cmyPath}") center center;
            min-width: 200px;
            min-height: 200px;
        }

        & image.yellow {
            background: url("file://${cmyPath}") bottom center;
            min-width: 200px;
            min-height: 200px;
        }

        & image.blend0 {
            background-image: url("file://${duckyPath}"),
                              linear-gradient(to right, red 0%, green 50%, blue 100%);
            background-size: cover;
            background-blend-mode: ${blendMode};
            min-width: 200px;
            min-height: 200px;
        }

        & image.blend1 {
            background: url("file://${blendsPath}") top center,
                        url("file://${blendsPath}") bottom center;
            background-blend-mode: ${blendMode};
            min-width: 200px;
            min-height: 200px;
        }

        & image.blend2 {
            background: url("file://${cmyPath}") top center,
                        url("file://${cmyPath}") center center,
                        url("file://${cmyPath}") bottom center;
            background-blend-mode: ${blendMode};
            min-width: 200px;
            min-height: 200px;
        }
    `;
}

const CssBlendmodesDemo = () => {
    const [stack, setStack] = useState<Gtk.Stack | null>(null);
    const [listbox, setListbox] = useState<Gtk.ListBox | null>(null);
    const [blendMode, setBlendMode] = useState("normal");

    const blendCss = useMemo(() => createBlendCss(blendMode), [blendMode]);

    const handleRowActivated = useCallback((row: Gtk.ListBoxRow) => {
        const index = row.getIndex();
        const mode = BLEND_MODES[index];
        if (mode) {
            setBlendMode(mode.id);
        }
    }, []);

    useEffect(() => {
        if (listbox) {
            const normalIndex = BLEND_MODES.findIndex((m) => m.id === "normal");
            const row = listbox.getRowAtIndex(normalIndex);
            if (row) {
                listbox.selectRow(row);
                row.grabFocus();
            }
        }
    }, [listbox]);

    return (
        <GtkGrid
            cssClasses={[blendCss]}
            marginStart={12}
            marginEnd={12}
            marginTop={12}
            marginBottom={12}
            rowSpacing={12}
            columnSpacing={12}
        >
            <x.GridChild column={0} row={0}>
                <GtkLabel label="Blend mode:" xalign={0} cssClasses={["dim-label"]} />
            </x.GridChild>

            <x.GridChild column={0} row={1}>
                <GtkScrolledWindow vexpand hasFrame minContentWidth={150}>
                    <GtkListBox ref={setListbox} onRowActivated={handleRowActivated}>
                        {BLEND_MODES.map((mode) => (
                            <GtkListBoxRow key={mode.id}>
                                <GtkLabel label={mode.name} xalign={0} />
                            </GtkListBoxRow>
                        ))}
                    </GtkListBox>
                </GtkScrolledWindow>
            </x.GridChild>

            <x.GridChild column={1} row={0}>
                <GtkStackSwitcher stack={stack} halign={Gtk.Align.CENTER} hexpand />
            </x.GridChild>

            <x.GridChild column={1} row={1}>
                <GtkStack
                    ref={setStack}
                    hexpand
                    vexpand
                    hhomogeneous={false}
                    vhomogeneous={false}
                    transitionType={Gtk.StackTransitionType.CROSSFADE}
                >
                    <x.StackPage id="page0" title="Ducky">
                        <GtkGrid
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            vexpand
                            rowSpacing={12}
                            columnSpacing={12}
                        >
                            <x.GridChild column={0} row={0}>
                                <GtkLabel label="Duck" />
                            </x.GridChild>
                            <x.GridChild column={1} row={0}>
                                <GtkLabel label="Background" />
                            </x.GridChild>
                            <x.GridChild column={0} row={1}>
                                <GtkImage cssClasses={["duck"]} />
                            </x.GridChild>
                            <x.GridChild column={1} row={1}>
                                <GtkImage cssClasses={["gradient"]} />
                            </x.GridChild>
                            <x.GridChild column={0} row={2} columnSpan={2}>
                                <GtkLabel label="Blended picture" />
                            </x.GridChild>
                            <x.GridChild column={0} row={3} columnSpan={2}>
                                <GtkImage halign={Gtk.Align.CENTER} cssClasses={["blend0"]} />
                            </x.GridChild>
                        </GtkGrid>
                    </x.StackPage>

                    <x.StackPage id="page1" title="Blends">
                        <GtkGrid
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            vexpand
                            rowSpacing={12}
                            columnSpacing={12}
                        >
                            <x.GridChild column={0} row={0}>
                                <GtkLabel label="Red" />
                            </x.GridChild>
                            <x.GridChild column={1} row={0}>
                                <GtkLabel label="Blue" />
                            </x.GridChild>
                            <x.GridChild column={0} row={1}>
                                <GtkImage cssClasses={["red"]} />
                            </x.GridChild>
                            <x.GridChild column={1} row={1}>
                                <GtkImage cssClasses={["blue"]} />
                            </x.GridChild>
                            <x.GridChild column={0} row={2} columnSpan={2}>
                                <GtkLabel label="Blended picture" />
                            </x.GridChild>
                            <x.GridChild column={0} row={3} columnSpan={2}>
                                <GtkImage halign={Gtk.Align.CENTER} cssClasses={["blend1"]} />
                            </x.GridChild>
                        </GtkGrid>
                    </x.StackPage>

                    <x.StackPage id="page2" title="CMYK">
                        <GtkGrid
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            hexpand
                            vexpand
                            rowSpacing={6}
                            columnSpacing={12}
                        >
                            <x.GridChild column={0} row={0}>
                                <GtkLabel label="Cyan" xalign={0} cssClasses={["dim-label"]} />
                            </x.GridChild>
                            <x.GridChild column={1} row={0}>
                                <GtkLabel label="Magenta" xalign={0} cssClasses={["dim-label"]} />
                            </x.GridChild>
                            <x.GridChild column={0} row={1}>
                                <GtkImage cssClasses={["cyan"]} />
                            </x.GridChild>
                            <x.GridChild column={1} row={1}>
                                <GtkImage cssClasses={["magenta"]} />
                            </x.GridChild>
                            <x.GridChild column={0} row={2}>
                                <GtkLabel label="Yellow" xalign={0} cssClasses={["dim-label"]} />
                            </x.GridChild>
                            <x.GridChild column={1} row={2}>
                                <GtkLabel label="&lt;b&gt;Blended picture&lt;/b&gt;" useMarkup xalign={0} />
                            </x.GridChild>
                            <x.GridChild column={0} row={3}>
                                <GtkImage cssClasses={["yellow"]} />
                            </x.GridChild>
                            <x.GridChild column={1} row={3}>
                                <GtkImage halign={Gtk.Align.CENTER} cssClasses={["blend2"]} />
                            </x.GridChild>
                        </GtkGrid>
                    </x.StackPage>
                </GtkStack>
            </x.GridChild>
        </GtkGrid>
    );
};

export const cssBlendmodesDemo: Demo = {
    id: "css-blendmodes",
    title: "Theming/CSS Blend Modes",
    description: "You can blend multiple backgrounds using the CSS blend modes available.",
    keywords: ["css", "blend", "mode", "multiply", "screen", "overlay", "compositing"],
    component: CssBlendmodesDemo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 300,
};
