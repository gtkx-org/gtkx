import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkGrid,
    GtkGridChild,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkScrolledWindow,
    GtkStack,
    GtkStackPage,
    GtkStackSwitcher,
} from "@gtkx/react";
import { useState } from "react";
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
            background-image: url("${duckyPath}");
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
            background: url("${blendsPath}") top center;
            min-width: 200px;
            min-height: 200px;
        }

        & image.blue {
            background: url("${blendsPath}") bottom center;
            min-width: 200px;
            min-height: 200px;
        }

        & image.cyan {
            background: url("${cmyPath}") top center;
            min-width: 200px;
            min-height: 200px;
        }

        & image.magenta {
            background: url("${cmyPath}") center center;
            min-width: 200px;
            min-height: 200px;
        }

        & image.yellow {
            background: url("${cmyPath}") bottom center;
            min-width: 200px;
            min-height: 200px;
        }

        & image.blend0 {
            background-image: url("${duckyPath}"),
                              linear-gradient(to right, red 0%, green 50%, blue 100%);
            background-size: cover;
            background-blend-mode: ${blendMode};
            min-width: 200px;
            min-height: 200px;
        }

        & image.blend1 {
            background: url("${blendsPath}") top center,
                        url("${blendsPath}") bottom center;
            background-blend-mode: ${blendMode};
            min-width: 200px;
            min-height: 200px;
        }

        & image.blend2 {
            background: url("${cmyPath}") top center,
                        url("${cmyPath}") center center,
                        url("${cmyPath}") bottom center;
            background-blend-mode: ${blendMode};
            min-width: 200px;
            min-height: 200px;
        }
    `;
}

const BlendStack = ({ stackRef, visible }: { stackRef: (s: Gtk.Stack | null) => void; visible: boolean }) => (
    <GtkStack
        name="blend-stack"
        ref={stackRef}
        hexpand
        vexpand
        hhomogeneous={false}
        vhomogeneous={false}
        transitionType={Gtk.StackTransitionType.CROSSFADE}
        visible={visible}
    >
        <GtkStackPage id="page0" title="Ducky">
            <DuckyPage />
        </GtkStackPage>
        <GtkStackPage id="page1" title="Blends">
            <BlendsPage />
        </GtkStackPage>
        <GtkStackPage id="page2" title="CMYK">
            <CmykPage />
        </GtkStackPage>
    </GtkStack>
);

interface BlendPageProps {
    labels: [string, string];
    leftClass: string;
    rightClass: string;
    blendClass: string;
}

const BlendPage = ({ labels, leftClass, rightClass, blendClass }: BlendPageProps) => (
    <GtkGrid halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} vexpand rowSpacing={12} columnSpacing={12}>
        <GtkGridChild column={0} row={0}>
            <GtkLabel label={labels[0]} />
        </GtkGridChild>
        <GtkGridChild column={1} row={0}>
            <GtkLabel label={labels[1]} />
        </GtkGridChild>
        <GtkGridChild column={0} row={1}>
            <GtkImage cssClasses={[leftClass]} />
        </GtkGridChild>
        <GtkGridChild column={1} row={1}>
            <GtkImage cssClasses={[rightClass]} />
        </GtkGridChild>
        <GtkGridChild column={0} row={2} columnSpan={2}>
            <GtkLabel label="Blended picture" />
        </GtkGridChild>
        <GtkGridChild column={0} row={3} columnSpan={2}>
            <GtkImage halign={Gtk.Align.CENTER} cssClasses={[blendClass]} />
        </GtkGridChild>
    </GtkGrid>
);

const DuckyPage = () => (
    <BlendPage labels={["Duck", "Background"]} leftClass="duck" rightClass="gradient" blendClass="blend0" />
);

const BlendsPage = () => <BlendPage labels={["Red", "Blue"]} leftClass="red" rightClass="blue" blendClass="blend1" />;

const CmykPage = () => (
    <GtkGrid halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} hexpand vexpand rowSpacing={6} columnSpacing={12}>
        <GtkGridChild column={0} row={0}>
            <GtkLabel label="Cyan" xalign={0} cssClasses={["dim-label"]} />
        </GtkGridChild>
        <GtkGridChild column={1} row={0}>
            <GtkLabel label="Magenta" xalign={0} cssClasses={["dim-label"]} />
        </GtkGridChild>
        <GtkGridChild column={0} row={1}>
            <GtkImage cssClasses={["cyan"]} />
        </GtkGridChild>
        <GtkGridChild column={1} row={1}>
            <GtkImage cssClasses={["magenta"]} />
        </GtkGridChild>
        <GtkGridChild column={0} row={2}>
            <GtkLabel label="Yellow" xalign={0} cssClasses={["dim-label"]} />
        </GtkGridChild>
        <GtkGridChild column={1} row={2}>
            <GtkLabel label="<b>Blended picture</b>" useMarkup xalign={0} />
        </GtkGridChild>
        <GtkGridChild column={0} row={3}>
            <GtkImage cssClasses={["yellow"]} />
        </GtkGridChild>
        <GtkGridChild column={1} row={3}>
            <GtkImage halign={Gtk.Align.CENTER} cssClasses={["blend2"]} />
        </GtkGridChild>
    </GtkGrid>
);

const CssBlendmodesDemo = () => {
    const [stack, setStack] = useState<Gtk.Stack | null>(null);
    const [blendMode, setBlendMode] = useState("normal");

    const blendCss = createBlendCss(blendMode);

    const handleRowActivated = (row: Gtk.ListBoxRow) => {
        const index = row.getIndex();
        const mode = BLEND_MODES[index];
        if (mode) setBlendMode(mode.id);
    };

    const selectAndFocusNormalRow = (widget: Gtk.Widget) => {
        const listbox = widget as Gtk.ListBox;
        const normalIndex = BLEND_MODES.findIndex((m) => m.id === "normal");
        const row = listbox.getRowAtIndex(normalIndex);
        if (row) {
            listbox.selectRow(row);
            row.grabFocus();
        }
    };

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
            <GtkGridChild column={0} row={0}>
                <GtkLabel label="Blend mode:" xalign={0} cssClasses={["dim-label"]} />
            </GtkGridChild>

            <GtkGridChild column={0} row={1}>
                <GtkScrolledWindow vexpand hasFrame minContentWidth={150}>
                    <GtkListBox
                        name="blend-list"
                        onRowActivated={handleRowActivated}
                        onRealize={selectAndFocusNormalRow}
                    >
                        {BLEND_MODES.map((mode) => (
                            <GtkListBoxRow key={mode.id}>
                                <GtkLabel label={mode.name} xalign={0} />
                            </GtkListBoxRow>
                        ))}
                    </GtkListBox>
                </GtkScrolledWindow>
            </GtkGridChild>

            <GtkGridChild column={1} row={0}>
                <GtkStackSwitcher stack={stack} halign={Gtk.Align.CENTER} hexpand visible={stack !== null} />
            </GtkGridChild>

            <GtkGridChild column={1} row={1}>
                <BlendStack stackRef={setStack} visible={stack !== null} />
            </GtkGridChild>
        </GtkGrid>
    );
};

export const cssBlendmodesDemo: Demo = {
    id: "css-blendmodes",
    title: "Theming/CSS Blend Modes",
    description: "You can blend multiple backgrounds using the CSS blend modes available.",
    keywords: [],
    component: CssBlendmodesDemo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 300,
    resizable: false,
};
