import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, FlowBox, Label, ScrolledWindow } from "@gtkx/react";
import { useState } from "react";

interface Tag {
    id: string;
    name: string;
    color: string;
}

const tags: Tag[] = [
    { id: "1", name: "React", color: "#61dafb" },
    { id: "2", name: "TypeScript", color: "#3178c6" },
    { id: "3", name: "GTK", color: "#4a90d9" },
    { id: "4", name: "Linux", color: "#fcc624" },
    { id: "5", name: "JavaScript", color: "#f7df1e" },
    { id: "6", name: "Node.js", color: "#339933" },
    { id: "7", name: "Python", color: "#3776ab" },
    { id: "8", name: "Rust", color: "#dea584" },
    { id: "9", name: "Go", color: "#00add8" },
    { id: "10", name: "C++", color: "#00599c" },
    { id: "11", name: "Docker", color: "#2496ed" },
    { id: "12", name: "Git", color: "#f05032" },
    { id: "13", name: "VSCode", color: "#007acc" },
    { id: "14", name: "Vim", color: "#019733" },
    { id: "15", name: "GraphQL", color: "#e10098" },
    { id: "16", name: "PostgreSQL", color: "#336791" },
    { id: "17", name: "Redis", color: "#dc382d" },
    { id: "18", name: "Kubernetes", color: "#326ce5" },
];

const tagChip = (color: string) => css`
    background: alpha(${color}, 0.2);
    border: 1px solid alpha(${color}, 0.5);
    border-radius: 16px;
    padding: 6px 14px;
`;

const colorDot = (color: string) => css`
    background: ${color};
    border-radius: 50%;
    min-width: 8px;
    min-height: 8px;
`;

export const FlowBoxDemo = () => {
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(["1", "2", "3"]));

    const handleChildActivated = (_flowbox: Gtk.FlowBox, child: Gtk.FlowBoxChild) => {
        const index = child.getIndex();
        const tag = tags[index];
        if (tag) {
            setSelectedTags((prev) => {
                const next = new Set(prev);
                if (next.has(tag.id)) {
                    next.delete(tag.id);
                } else {
                    next.add(tag.id);
                }
                return next;
            });
        }
    };

    const selectedTagNames = tags.filter((t) => selectedTags.has(t.id)).map((t) => t.name);

    return (
        <Box
            orientation={Gtk.Orientation.VERTICAL}
            spacing={16}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
            hexpand
            vexpand
        >
            <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <Label label="FlowBox" cssClasses={["title-1"]} halign={Gtk.Align.START} />
                <Label
                    label="GtkFlowBox arranges children in a flowing layout. Children reflow automatically when the container is resized. Great for tag clouds, icon grids, and dynamic layouts."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12} vexpand>
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                    <Label label="Technology Tags" cssClasses={["heading"]} halign={Gtk.Align.START} hexpand />
                    <Label label={`${selectedTags.size} selected`} cssClasses={["dim-label"]} />
                </Box>

                <Label
                    label="Click tags to toggle selection. Resize the window to see tags reflow."
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />

                <ScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <FlowBox
                        selectionMode={Gtk.SelectionMode.NONE}
                        maxChildrenPerLine={8}
                        minChildrenPerLine={2}
                        columnSpacing={8}
                        rowSpacing={8}
                        homogeneous={false}
                        onChildActivated={handleChildActivated}
                        activateOnSingleClick
                    >
                        {tags.map((tag) => (
                            <Box
                                key={tag.id}
                                orientation={Gtk.Orientation.HORIZONTAL}
                                spacing={8}
                                cssClasses={[tagChip(tag.color)]}
                                focusable
                            >
                                <Box
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={0}
                                    cssClasses={[colorDot(tag.color)]}
                                />
                                <Label label={tag.name} />
                            </Box>
                        ))}
                    </FlowBox>
                </ScrolledWindow>

                {selectedTagNames.length > 0 && (
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} cssClasses={["card"]} marginTop={8}>
                        <Box
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={4}
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        >
                            <Label label="Selected Technologies" cssClasses={["heading"]} halign={Gtk.Align.START} />
                            <Label label={selectedTagNames.join(", ")} halign={Gtk.Align.START} wrap />
                        </Box>
                    </Box>
                )}
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <Label label="Key Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="• Automatic reflow on resize\n• minChildrenPerLine and maxChildrenPerLine\n• columnSpacing and rowSpacing\n• Multiple selection modes\n• homogeneous for uniform sizing"
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};
