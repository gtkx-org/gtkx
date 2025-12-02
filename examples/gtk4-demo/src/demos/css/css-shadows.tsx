import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const cardBase = css`
    padding: 24px;
    border-radius: 12px;
    background: @card_bg_color;
`;

const shadowSmall = css`
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
`;

const shadowMedium = css`
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
`;

const shadowLarge = css`
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.19);
`;

const coloredShadow = css`
    box-shadow: 0 10px 30px rgba(53, 132, 228, 0.4);
    background: #3584e4;
    color: white;
`;

const multiShadow = css`
    box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.1),
        0 8px 16px rgba(0, 0, 0, 0.1),
        0 16px 32px rgba(0, 0, 0, 0.1);
`;

const CssShadowsDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="CSS Shadows" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About Shadows" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GTK CSS supports box-shadow for adding depth and elevation to widgets."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Shadow Sizes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={24} halign={Gtk.Align.CENTER}>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <Box
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={0}
                            cssClasses={[cardBase, shadowSmall]}
                            widthRequest={100}
                            heightRequest={100}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                        >
                            <Label.Root label="Small" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                        </Box>
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <Box
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={0}
                            cssClasses={[cardBase, shadowMedium]}
                            widthRequest={100}
                            heightRequest={100}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                        >
                            <Label.Root label="Medium" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                        </Box>
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <Box
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={0}
                            cssClasses={[cardBase, shadowLarge]}
                            widthRequest={100}
                            heightRequest={100}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                        >
                            <Label.Root label="Large" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                        </Box>
                    </Box>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Colored Shadow" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={[cardBase, coloredShadow]}
                    halign={Gtk.Align.CENTER}
                    widthRequest={200}
                    heightRequest={100}
                    valign={Gtk.Align.CENTER}
                >
                    <Label.Root label="Blue Glow" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Multi-layer Shadow" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={[cardBase, multiShadow]}
                    halign={Gtk.Align.CENTER}
                    widthRequest={200}
                    heightRequest={100}
                    valign={Gtk.Align.CENTER}
                >
                    <Label.Root label="Layered" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </Box>
            </Box>
        </Box>
    );
};

export const cssShadowsDemo: Demo = {
    id: "css-shadows",
    title: "CSS Shadows",
    description: "Box shadows for depth and elevation effects.",
    keywords: ["css", "shadow", "elevation", "depth", "box-shadow"],
    component: CssShadowsDemo,
    sourcePath: getSourcePath(import.meta.url, "css-shadows.tsx"),
};
