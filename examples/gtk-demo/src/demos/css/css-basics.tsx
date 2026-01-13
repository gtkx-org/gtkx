import { css, cx } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkToggleButton } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./css-basics.tsx?raw";

const demoBoxStyle = css`
 background-color: @accent_bg_color;
 color: @accent_fg_color;
 padding: 24px;
 border-radius: 12px;

 &:hover {
 background-color: shade(@accent_bg_color, 1.1);
 }
`;

const demoLabelStyle = css`
 font-size: 18px;
 font-weight: bold;
`;

const demoButtonStyle = css`
 padding: 12px 24px;
 border-radius: 8px;
 background-color: @success_bg_color;
 color: @success_fg_color;

 &:hover {
 background-color: shade(@success_bg_color, 1.15);
 }
`;

const alternateBoxStyle = css`
 background-color: @warning_bg_color;
 color: @warning_fg_color;
`;

const CODE_EXAMPLE = `// Import the css utilities
import { css, cx } from "@gtkx/css";

// Define styles with css\`\`
const boxStyle = css\`
 background-color: @accent_bg_color;
 color: @accent_fg_color;
 padding: 24px;
 border-radius: 12px;
\`;

// Use cx() to combine styles
const combined = cx(boxStyle, isActive && activeStyle);

// Apply to components
<GtkBox cssClasses={[boxStyle]} />
<GtkBox cssClasses={[cx(boxStyle, activeStyle)]} />`;

const CssBasicsDemo = () => {
    const [useAlternate, setUseAlternate] = useState(false);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="CSS Basics" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GTKX uses an Emotion-based CSS-in-JS system. Use the css`` tagged template to define styles, and cx() to conditionally combine them. GTK CSS supports theme variables like @accent_bg_color and functions like shade()."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkBox spacing={20} vexpand>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} hexpand>
                    <GtkLabel label="Usage Example" cssClasses={["heading"]} halign={Gtk.Align.START} />

                    <GtkFrame>
                        <GtkLabel
                            label={CODE_EXAMPLE}
                            halign={Gtk.Align.START}
                            cssClasses={["monospace"]}
                            marginStart={16}
                            marginEnd={16}
                            marginTop={16}
                            marginBottom={16}
                            selectable
                        />
                    </GtkFrame>
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} hexpand>
                    <GtkLabel label="Live Preview" cssClasses={["heading"]} halign={Gtk.Align.START} />

                    <GtkFrame>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={16}
                            marginTop={20}
                            marginBottom={20}
                            marginStart={20}
                            marginEnd={20}
                        >
                            <GtkToggleButton
                                label={useAlternate ? "Using alternate style" : "Using default style"}
                                active={useAlternate}
                                onToggled={(btn: Gtk.ToggleButton) => setUseAlternate(btn.getActive())}
                                halign={Gtk.Align.CENTER}
                            />

                            <GtkBox
                                cssClasses={[cx(demoBoxStyle, useAlternate && alternateBoxStyle)]}
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={12}
                                halign={Gtk.Align.CENTER}
                            >
                                <GtkLabel label="Styled Box" cssClasses={[demoLabelStyle]} />
                                <GtkLabel label="Toggle the button to switch styles!" />
                            </GtkBox>

                            <GtkButton
                                label="Styled Button"
                                cssClasses={[demoButtonStyle]}
                                halign={Gtk.Align.CENTER}
                                onClicked={() => {}}
                            />

                            <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
                                <GtkButton label="Normal" onClicked={() => {}} />
                                <GtkButton label="Suggested" cssClasses={["suggested-action"]} onClicked={() => {}} />
                                <GtkButton
                                    label="Destructive"
                                    cssClasses={["destructive-action"]}
                                    onClicked={() => {}}
                                />
                            </GtkBox>
                        </GtkBox>
                    </GtkFrame>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="GTK CSS Reference" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Common theme variables: @theme_bg_color, @theme_fg_color, @accent_bg_color, @accent_fg_color, @success_bg_color, @warning_bg_color, @error_bg_color. Functions: shade(color, factor), mix(color1, color2, factor), alpha(color, alpha)."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const cssBasicsDemo: Demo = {
    id: "css-basics",
    title: "CSS Basics",
    description: "Live CSS editor to explore GTK styling",
    keywords: ["css", "style", "theme", "emotion", "css-in-js"],
    component: CssBasicsDemo,
    sourceCode,
};
