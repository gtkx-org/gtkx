import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkGrid,
    GtkGridLayoutChild,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkScrolledWindow,
    GtkStack,
    GtkStackPage,
    GtkStackSwitcher,
} from "@gtkx/jsx/gtk";
import { type Ref, useState } from "react";
import blendsPath from "#data/demos/css/blends.png";
import cmyPath from "#data/demos/css/cmy.jpg";
import duckyPath from "#data/demos/css/ducky.png";
import type { Demo } from "../types.js";
import sourceCode from "./css-blendmodes.tsx?raw";

type BlendPageProps = {
    labels: [string, string];
    leftClass: string;
    rightClass: string;
    blendClass: string;
};

type BlendModeListProps = {
    onRowActivated: (row: Gtk.ListBoxRow) => void;
};

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

const SOURCE_IMAGES_CSS = `
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
`;

const cssBlendmodesDemo: Demo = {
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

function createBlendCss(blendMode: string) {
    return css`
        ${SOURCE_IMAGES_CSS}

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

const BlendStack = ({ ref, visible }: { ref?: Ref<Gtk.Stack | null>; visible: boolean }) => (
    <GtkStack
        name="blend-stack"
        ref={ref}
        hexpand
        vexpand
        hhomogeneous={false}
        vhomogeneous={false}
        transitionType={Gtk.StackTransitionType.CROSSFADE}
        visible={visible}
    >
        <GtkStackPage name="page0" title="Ducky">
            <DuckyPage />
        </GtkStackPage>
        <GtkStackPage name="page1" title="Blends">
            <BlendsPage />
        </GtkStackPage>
        <GtkStackPage name="page2" title="CMYK">
            <CmykPage />
        </GtkStackPage>
    </GtkStack>
);

const BlendPage = ({ labels, leftClass, rightClass, blendClass }: BlendPageProps) => (
    <GtkGrid halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} vexpand rowSpacing={12} columnSpacing={12}>
        <GtkGridLayoutChild column={0} row={0}>
            <GtkLabel>{labels[0]}</GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={0}>
            <GtkLabel>{labels[1]}</GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={0} row={1}>
            <GtkImage cssClasses={[leftClass]} />
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={1}>
            <GtkImage cssClasses={[rightClass]} />
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={0} row={2} columnSpan={2}>
            <GtkLabel>Blended picture</GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={0} row={3} columnSpan={2}>
            <GtkImage halign={Gtk.Align.CENTER} cssClasses={[blendClass]} />
        </GtkGridLayoutChild>
    </GtkGrid>
);

const DuckyPage = () => (
    <BlendPage labels={["Duck", "Background"]} leftClass="duck" rightClass="gradient" blendClass="blend0" />
);

const BlendsPage = () => <BlendPage labels={["Red", "Blue"]} leftClass="red" rightClass="blue" blendClass="blend1" />;

const CmykPage = () => (
    <GtkGrid halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} hexpand vexpand rowSpacing={6} columnSpacing={12}>
        <GtkGridLayoutChild column={0} row={0}>
            <GtkLabel xalign={0} cssClasses={["dim-label"]}>
                Cyan
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={0}>
            <GtkLabel xalign={0} cssClasses={["dim-label"]}>
                Magenta
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={0} row={1}>
            <GtkImage cssClasses={["cyan"]} />
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={1}>
            <GtkImage cssClasses={["magenta"]} />
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={0} row={2}>
            <GtkLabel xalign={0} cssClasses={["dim-label"]}>
                Yellow
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={2}>
            <GtkLabel useMarkup xalign={0}>
                {"<b>Blended picture</b>"}
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={0} row={3}>
            <GtkImage cssClasses={["yellow"]} />
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={3}>
            <GtkImage halign={Gtk.Align.CENTER} cssClasses={["blend2"]} />
        </GtkGridLayoutChild>
    </GtkGrid>
);

const selectAndFocusNormalRow = (widget: Gtk.Widget) => {
    const listbox = widget as Gtk.ListBox;
    const normalIndex = BLEND_MODES.findIndex((m) => m.id === "normal");
    const row = listbox.getRowAtIndex(normalIndex);

    if (row) {
        listbox.selectRow(row);
        row.grabFocus();
    }
};

const BlendModeList = ({ onRowActivated }: BlendModeListProps) => (
    <GtkScrolledWindow vexpand hasFrame minContentWidth={150}>
        <GtkListBox name="blend-list" onRowActivated={onRowActivated} onRealize={selectAndFocusNormalRow}>
            {BLEND_MODES.map((mode) => (
                <GtkListBoxRow key={mode.id}>
                    <GtkLabel xalign={0}>{mode.name}</GtkLabel>
                </GtkListBoxRow>
            ))}
        </GtkListBox>
    </GtkScrolledWindow>
);

function CssBlendmodesDemo() {
    const [stack, setStack] = useState<Gtk.Stack | null>(null);
    const [blendMode, setBlendMode] = useState("normal");
    const blendCss = createBlendCss(blendMode);

    const handleRowActivated = (row: Gtk.ListBoxRow) => {
        const index = row.getIndex();
        const mode = BLEND_MODES[index];

        if (mode) {
            setBlendMode(mode.id);
        }
    };

    return (
        <GtkGrid
            name="blend-root"
            cssClasses={[blendCss]}
            marginStart={12}
            marginEnd={12}
            marginTop={12}
            marginBottom={12}
            rowSpacing={12}
            columnSpacing={12}
        >
            <GtkGridLayoutChild column={0} row={0}>
                <GtkLabel xalign={0} cssClasses={["dim-label"]}>
                    Blend mode:
                </GtkLabel>
            </GtkGridLayoutChild>

            <GtkGridLayoutChild column={0} row={1}>
                <BlendModeList onRowActivated={handleRowActivated} />
            </GtkGridLayoutChild>

            <GtkGridLayoutChild column={1} row={0}>
                <GtkStackSwitcher stack={stack} halign={Gtk.Align.CENTER} hexpand visible={stack !== null} />
            </GtkGridLayoutChild>

            <GtkGridLayoutChild column={1} row={1}>
                <BlendStack
                    ref={(node) => {
                        setStack(node);
                    }}
                    visible={stack !== null}
                />
            </GtkGridLayoutChild>
        </GtkGrid>
    );
}

export { cssBlendmodesDemo };
