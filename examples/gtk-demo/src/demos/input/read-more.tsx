import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./read-more.tsx?raw";

const SAMPLE_TEXT = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.`;

const ARTICLES = [
    {
        title: "Getting Started with GTKX",
        summary: "Learn how to build native Linux desktop applications using React and GTK4.",
        content: `GTKX is a React framework for building native GTK4 desktop applications on Linux. It combines the familiarity of React's component model with the power of native GTK widgets.

With GTKX, you can use familiar React patterns like useState, useEffect, and custom hooks while building applications that integrate seamlessly with the Linux desktop. The framework handles all the complexity of bridging JavaScript and native GTK code through its FFI layer.`,
    },
    {
        title: "Understanding Widget Layout",
        summary: "Explore the different layout options available in GTK4.",
        content: `GTK4 provides several layout containers for organizing widgets. GtkBox arranges children in a single row or column. GtkGrid places children in a grid pattern. GtkFlowBox automatically wraps children when space runs out.

For more complex layouts, you can use GtkFixed for absolute positioning, GtkOverlay for layered widgets, or the new constraint-based layout system for flexible, responsive designs.`,
    },
    {
        title: "Styling with CSS",
        summary: "Customize the appearance of your application using CSS.",
        content: `GTK4 uses CSS for styling widgets. You can apply built-in CSS classes like 'suggested-action', 'destructive-action', 'card', and 'dim-label'. For custom styles, use @gtkx/css with css\`\` tagged templates and cx() for conditional styles.

GTK CSS supports theme colors (@accent_bg_color, @theme_fg_color), gradients, shadows, animations, and most standard CSS properties. Some GTK-specific extensions like -gtk-icontheme() allow referencing theme icons.`,
    },
];

const ReadMoreDemo = () => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [lineLimit, setLineLimit] = useState(3);

    const toggleExpand = (index: number) => {
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Read More" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Expandable text sections with 'Read more' functionality. This pattern is useful for showing previews of long content while allowing users to expand for full details."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Line-Limited Text">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox spacing={12} halign={Gtk.Align.START}>
                        <GtkLabel label="Line limit:" cssClasses={["dim-label"]} />
                        {[2, 3, 4, 5].map((lines) => (
                            <GtkButton
                                key={lines}
                                label={String(lines)}
                                cssClasses={lineLimit === lines ? ["suggested-action"] : ["flat"]}
                                onClicked={() => setLineLimit(lines)}
                            />
                        ))}
                    </GtkBox>

                    <GtkLabel
                        label={SAMPLE_TEXT}
                        wrap
                        lines={lineLimit}
                        ellipsize={3} // PANGO_ELLIPSIZE_END
                        halign={Gtk.Align.START}
                    />

                    <GtkLabel
                        label={`Using lines={${lineLimit}} with ellipsize to truncate text`}
                        cssClasses={["caption", "dim-label"]}
                        halign={Gtk.Align.START}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Expandable Articles">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    {ARTICLES.map((article, index) => (
                        <GtkBox
                            key={article.title}
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            cssClasses={["card"]}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        >
                            <GtkLabel label={article.title} cssClasses={["heading"]} halign={Gtk.Align.START} />

                            {expandedIndex === index ? (
                                <GtkLabel label={article.content} wrap halign={Gtk.Align.START} />
                            ) : (
                                <GtkLabel
                                    label={article.summary}
                                    wrap
                                    cssClasses={["dim-label"]}
                                    halign={Gtk.Align.START}
                                />
                            )}

                            <GtkButton
                                label={expandedIndex === index ? "Show less" : "Read more"}
                                cssClasses={["flat"]}
                                halign={Gtk.Align.START}
                                onClicked={() => toggleExpand(index)}
                            />
                        </GtkBox>
                    ))}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Implementation">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel
                        label="Two approaches for expandable text:"
                        cssClasses={["heading"]}
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label="1. Use the 'lines' and 'ellipsize' props on GtkLabel for automatic truncation"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkLabel
                        label="2. Toggle between summary and full content with state"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const readMoreDemo: Demo = {
    id: "read-more",
    title: "Read More",
    description: "Expandable text with 'Read more' functionality",
    keywords: ["text", "expand", "read more", "truncate", "ellipsis", "lines", "collapse"],
    component: ReadMoreDemo,
    sourceCode,
};
