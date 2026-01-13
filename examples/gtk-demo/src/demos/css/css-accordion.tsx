import { css, cx, injectGlobal } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkExpander, GtkFrame, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./css-accordion.tsx?raw";

injectGlobal`
 /* Transition timing functions */
 .transition-ease {
 transition: all 300ms ease;
 }

 .transition-ease-in {
 transition: all 300ms ease-in;
 }

 .transition-ease-out {
 transition: all 300ms ease-out;
 }

 .transition-ease-in-out {
 transition: all 300ms ease-in-out;
 }

 .transition-linear {
 transition: all 300ms linear;
 }

 /* Animated button states */
 .animated-button {
 transition: all 200ms ease-out;
 padding: 12px 24px;
 border-radius: 8px;
 }

 .animated-button:hover {
 background-color: shade(@accent_bg_color, 1.1);
 box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
 }

 .animated-button:active {
 background-color: shade(@accent_bg_color, 0.9);
 box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
 }

 /* Scale on hover */
 .scale-hover {
 transition: all 200ms ease;
 }

 .scale-hover:hover {
 -gtk-icon-transform: scale(1.1);
 }
`;

const accordionPanelStyle = css`
 background-color: @theme_bg_color;
 border-radius: 8px;
 padding: 12px 16px;
 margin: 4px 0;
 transition: background-color 200ms ease, box-shadow 200ms ease;

 &:hover {
 background-color: alpha(@accent_bg_color, 0.1);
 }
`;

const accordionPanelActiveStyle = css`
 background-color: alpha(@accent_bg_color, 0.15);
 box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const colorTransitionStyle = css`
 transition: background-color 500ms ease, color 500ms ease;
 padding: 16px 24px;
 border-radius: 8px;
`;

const colorBlueStyle = css`background-color: #3584e4; color: white;`;
const colorGreenStyle = css`background-color: #2ec27e; color: white;`;
const colorOrangeStyle = css`background-color: #ff7800; color: white;`;
const colorPurpleStyle = css`background-color: #9141ac; color: white;`;

const colorStyles: Record<string, string> = {
    "color-blue": colorBlueStyle,
    "color-green": colorGreenStyle,
    "color-orange": colorOrangeStyle,
    "color-purple": colorPurpleStyle,
};

interface AccordionItemProps {
    title: string;
    content: string;
    isOpen: boolean;
    onToggle: () => void;
}

const AccordionItem = ({ title, content, isOpen, onToggle }: AccordionItemProps) => (
    <GtkBox
        cssClasses={[cx(accordionPanelStyle, isOpen && accordionPanelActiveStyle)]}
        orientation={Gtk.Orientation.VERTICAL}
        spacing={8}
    >
        <GtkButton cssClasses={["flat"]} onClicked={onToggle}>
            <GtkBox spacing={12} hexpand>
                <GtkLabel label={isOpen ? "-" : "+"} cssClasses={["heading"]} widthChars={2} />
                <GtkLabel label={title} cssClasses={["heading"]} halign={Gtk.Align.START} hexpand />
            </GtkBox>
        </GtkButton>
        {isOpen && (
            <GtkBox orientation={Gtk.Orientation.VERTICAL} marginStart={24} marginTop={8} marginBottom={8}>
                <GtkLabel label={content} wrap cssClasses={["dim-label"]} halign={Gtk.Align.START} />
            </GtkBox>
        )}
    </GtkBox>
);

const CssAccordionDemo = () => {
    const [openPanel, setOpenPanel] = useState<number | null>(0);
    const [selectedColor, setSelectedColor] = useState("color-blue");

    const accordionItems = [
        {
            title: "What are CSS Transitions?",
            content:
                "CSS transitions allow you to smoothly animate property changes over time. In GTK, transitions work on properties like background-color, opacity, padding, and box-shadow.",
        },
        {
            title: "How do I use transitions?",
            content:
                "Add the 'transition' property to your CSS selector. For example: 'transition: all 300ms ease;' will animate all animatable properties over 300 milliseconds with an ease timing function.",
        },
        {
            title: "What timing functions are available?",
            content:
                "GTK CSS supports: ease (default), ease-in, ease-out, ease-in-out, and linear. Each affects how the animation accelerates and decelerates.",
        },
        {
            title: "Can I animate specific properties?",
            content:
                "Yes! Instead of 'all', specify the property name: 'transition: background-color 200ms ease, box-shadow 300ms ease-out;' to animate different properties with different timings.",
        },
    ];

    const togglePanel = (index: number) => {
        setOpenPanel(openPanel === index ? null : index);
    };

    const colors = [
        { id: "color-blue", label: "Blue" },
        { id: "color-green", label: "Green" },
        { id: "color-orange", label: "Orange" },
        { id: "color-purple", label: "Purple" },
    ];

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="CSS Transitions & Animations" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GTK CSS supports transitions for smooth property animations. Transitions automatically animate changes between states like :hover, :active, and custom classes."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Animated Accordion">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={4}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                >
                    {accordionItems.map((item, index) => (
                        <AccordionItem
                            key={item.title}
                            title={item.title}
                            content={item.content}
                            isOpen={openPanel === index}
                            onToggle={() => togglePanel(index)}
                        />
                    ))}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Color Transitions">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={20}
                    marginBottom={20}
                    marginStart={20}
                    marginEnd={20}
                >
                    <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                        {colors.map((color) => (
                            <GtkButton
                                key={color.id}
                                label={color.label}
                                cssClasses={selectedColor === color.id ? ["suggested-action"] : []}
                                onClicked={() => setSelectedColor(color.id)}
                            />
                        ))}
                    </GtkBox>

                    <GtkBox
                        cssClasses={[cx(colorTransitionStyle, colorStyles[selectedColor])]}
                        halign={Gtk.Align.CENTER}
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={4}
                    >
                        <GtkLabel label="Smooth Color Transition" cssClasses={["title-4"]} />
                        <GtkLabel label="Click a color button above" />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Interactive Button States">
                <GtkBox
                    spacing={24}
                    marginTop={24}
                    marginBottom={24}
                    marginStart={24}
                    marginEnd={24}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkButton cssClasses={["animated-button", "suggested-action"]} onClicked={() => {}}>
                            <GtkLabel label="Hover Me" />
                        </GtkButton>
                        <GtkLabel
                            label="Shadow + color"
                            cssClasses={["dim-label", "caption"]}
                            halign={Gtk.Align.CENTER}
                        />
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkButton
                            cssClasses={["transition-ease", "circular"]}
                            iconName="starred-symbolic"
                            onClicked={() => {}}
                        />
                        <GtkLabel
                            label="Smooth hover"
                            cssClasses={["dim-label", "caption"]}
                            halign={Gtk.Align.CENTER}
                        />
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkButton cssClasses={["transition-ease", "pill"]} onClicked={() => {}}>
                            <GtkLabel label="Pill Button" />
                        </GtkButton>
                        <GtkLabel
                            label="Rounded edges"
                            cssClasses={["dim-label", "caption"]}
                            halign={Gtk.Align.CENTER}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Native GtkExpander">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                >
                    <GtkLabel
                        label="GtkExpander has built-in expand/collapse animation:"
                        wrap
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />

                    <GtkExpander label="Click to expand with animation">
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} marginTop={8}>
                            <GtkLabel label="This content slides in smoothly using GTK's native animation." wrap />
                            <GtkLabel
                                label="GtkExpander handles the animation automatically - no CSS needed!"
                                wrap
                                cssClasses={["dim-label"]}
                            />
                        </GtkBox>
                    </GtkExpander>

                    <GtkExpander label="Another expandable section">
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} marginTop={8}>
                            <GtkLabel label="More animated content here." />
                        </GtkBox>
                    </GtkExpander>
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Timing Functions" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="ease: slow start and end, fast middle (default). ease-in: slow start. ease-out: slow end. ease-in-out: slow start and end. linear: constant speed throughout."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const cssAccordionDemo: Demo = {
    id: "css-accordion",
    title: "Theming/CSS Accordion",
    description: "Smooth animations with CSS transitions",
    keywords: ["css", "transition", "animation", "accordion", "timing", "ease"],
    component: CssAccordionDemo,
    sourceCode,
};
