import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const customButton = css`
    padding: 16px 32px;
    border-radius: 24px;
    font-size: 16px;
    font-weight: bold;
`;

const successStyle = css`
    background: #33d17a;
    color: white;
`;

const warningStyle = css`
    background: #f5c211;
    color: #3d3846;
`;

const dangerStyle = css`
    background: #e01b24;
    color: white;
`;

const gradientStyle = css`
    background: linear-gradient(135deg, #3584e4, #9141ac);
    color: white;
`;

const CssBasicsDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="CSS Basics" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About CSS Styling" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GTK widgets can be styled using CSS. GTKX provides @gtkx/css for CSS-in-JS styling similar to Emotion."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Custom <GtkButton Styles" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12} halign={Gtk.Align.CENTER}>
                    <GtkButton label="Success" cssClasses={[customButton, successStyle]} />
                    <GtkButton label="Warning" cssClasses={[customButton, warningStyle]} />
                    <GtkButton label="Danger" cssClasses={[customButton, dangerStyle]} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Gradient Backgrounds" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkButton
                    label="Gradient GtkButton"
                    cssClasses={[customButton, gradientStyle]}
                    halign={Gtk.Align.CENTER}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="System CSS Classes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GTK provides built-in CSS classes: suggested-action, destructive-action, card, boxed-list, heading, dim-label, etc."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12} halign={Gtk.Align.CENTER}>
                    <GtkButton label="Suggested" cssClasses={["suggested-action"]} />
                    <GtkButton label="Destructive" cssClasses={["destructive-action"]} />
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const cssBasicsDemo: Demo = {
    id: "css-basics",
    title: "CSS Basics",
    description: "Introduction to GTK CSS styling with CSS-in-JS.",
    keywords: ["css", "styling", "theme", "design", "colors"],
    component: CssBasicsDemo,
    sourcePath: getSourcePath(import.meta.url, "css-basics.tsx"),
};
