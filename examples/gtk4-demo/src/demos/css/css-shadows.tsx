import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/react";
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
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="CSS Shadows" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About Shadows" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GTK CSS supports box-shadow for adding depth and elevation to widgets."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Shadow Sizes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={24} halign={Gtk.Align.CENTER}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={0}
                            cssClasses={[cardBase, shadowSmall]}
                            widthRequest={100}
                            heightRequest={100}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                        >
                            <GtkLabel label="Small" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                        </GtkBox>
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={0}
                            cssClasses={[cardBase, shadowMedium]}
                            widthRequest={100}
                            heightRequest={100}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                        >
                            <GtkLabel label="Medium" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                        </GtkBox>
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={0}
                            cssClasses={[cardBase, shadowLarge]}
                            widthRequest={100}
                            heightRequest={100}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                        >
                            <GtkLabel label="Large" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Colored Shadow" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={[cardBase, coloredShadow]}
                    halign={Gtk.Align.CENTER}
                    widthRequest={200}
                    heightRequest={100}
                    valign={Gtk.Align.CENTER}
                >
                    <GtkLabel label="Blue Glow" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Multi-layer Shadow" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={[cardBase, multiShadow]}
                    halign={Gtk.Align.CENTER}
                    widthRequest={200}
                    heightRequest={100}
                    valign={Gtk.Align.CENTER}
                >
                    <GtkLabel label="Layered" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const cssShadowsDemo: Demo = {
    id: "css-shadows",
    title: "CSS Shadows",
    description: "GtkBox shadows for depth and elevation effects.",
    keywords: ["css", "shadow", "elevation", "depth", "box-shadow"],
    component: CssShadowsDemo,
    sourcePath: getSourcePath(import.meta.url, "css-shadows.tsx"),
};
