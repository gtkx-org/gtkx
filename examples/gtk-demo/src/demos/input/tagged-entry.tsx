import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkCheckButton, GtkEntry, GtkSpinner } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./tagged-entry.tsx?raw";

const TaggedEntryDemo = () => {
    const [tags, setTags] = useState<string[]>([]);
    const [showSpinner, setShowSpinner] = useState(false);

    const addTag = () => {
        const tagName = "Blue";
        if (!tags.includes(tagName)) {
            setTags([...tags, tagName]);
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter((t) => t !== tagToRemove));
    };

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={6}
            marginStart={18}
            marginEnd={18}
            marginTop={18}
            marginBottom={18}
        >
            <GtkBox spacing={6}>
                <GtkEntry hexpand />
                {tags.map((tag) => (
                    <GtkButton
                        key={tag}
                        label={`${tag} ×`}
                        cssClasses={["pill", "blue"]}
                        onClicked={() => removeTag(tag)}
                    />
                ))}
                {showSpinner && <GtkSpinner spinning />}
            </GtkBox>

            <GtkBox spacing={6} halign={Gtk.Align.END}>
                <GtkButton label="Add Tag" onClicked={addTag} />
                <GtkCheckButton label="Spinner" active={showSpinner} onToggled={(btn) => setShowSpinner(btn.getActive())} />
            </GtkBox>
        </GtkBox>
    );
};

export const taggedEntryDemo: Demo = {
    id: "tagged-entry",
    title: "Entry/Tagged Entry",
    description:
        "This example shows how to build a complex composite entry using GtkText. This tagged entry can display tags and other widgets inside the entry area.",
    keywords: ["tag", "entry", "composite", "GtkEntry", "chip"],
    component: TaggedEntryDemo,
    sourceCode,
};
