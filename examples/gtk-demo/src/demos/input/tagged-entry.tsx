import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkFlowBox, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./tagged-entry.tsx?raw";

const TaggedEntryDemo = () => {
    const [tags, setTags] = useState<string[]>(["react", "gtk4"]);
    const [inputText, setInputText] = useState("");

    const addTag = () => {
        const trimmedText = inputText.trim().toLowerCase();
        if (trimmedText && !tags.includes(trimmedText)) {
            setTags([...tags, trimmedText]);
            setInputText("");
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter((tag) => tag !== tagToRemove));
    };

    const handleKeyPress = (text: string) => {
        setInputText(text);
    };

    const handleActivate = () => {
        addTag();
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Tagged Entry" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Tag Input" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Enter text and press Enter or click Add to create tags. Click on a tag to remove it. This pattern is commonly used for entering multiple keywords or labels."
                    wrap
                    cssClasses={["dim-label"]}
                />

                <GtkBox spacing={8}>
                    <GtkEntry
                        text={inputText}
                        placeholderText="Type a tag and press Enter..."
                        hexpand
                        onChanged={(entry) => handleKeyPress(entry.getText())}
                        onActivate={handleActivate}
                    />
                    <GtkButton
                        label="Add"
                        cssClasses={["suggested-action"]}
                        onClicked={addTag}
                        sensitive={inputText.trim().length > 0}
                    />
                </GtkBox>

                <GtkFlowBox columnSpacing={8} rowSpacing={8} selectionMode={Gtk.SelectionMode.NONE}>
                    {tags.length === 0 ? (
                        <GtkLabel label="No tags yet" cssClasses={["dim-label"]} />
                    ) : (
                        tags.map((tag) => (
                            <GtkButton
                                key={tag}
                                label={`${tag} x`}
                                cssClasses={["pill"]}
                                onClicked={() => removeTag(tag)}
                            />
                        ))
                    )}
                </GtkFlowBox>

                <GtkLabel
                    label={`Tags: ${tags.length > 0 ? tags.join(", ") : "(none)"}`}
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Email Recipients" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="A common use case for tagged input is entering multiple email recipients."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <EmailTagInput />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Implementation Notes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`This demo shows a React-based implementation of tag/chip input. The pattern involves:

1. Maintaining an array of tags in state
2. Handling Enter key to add new tags
3. Preventing duplicate tags
4. Rendering tags as clickable buttons for removal

In a production app, you might also add:
- Tag validation
- Comma-separated input parsing
- Autocomplete suggestions
- Maximum tag limit`}
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

const EmailTagInput = () => {
    const [emails, setEmails] = useState<string[]>(["alice@example.com"]);
    const [inputText, setInputText] = useState("");
    const [error, setError] = useState("");

    const isValidEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const addEmail = () => {
        const trimmedEmail = inputText.trim().toLowerCase();
        if (!trimmedEmail) {
            setError("");
            return;
        }
        if (!isValidEmail(trimmedEmail)) {
            setError("Invalid email format");
            return;
        }
        if (emails.includes(trimmedEmail)) {
            setError("Email already added");
            return;
        }
        setEmails([...emails, trimmedEmail]);
        setInputText("");
        setError("");
    };

    const removeEmail = (emailToRemove: string) => {
        setEmails(emails.filter((email) => email !== emailToRemove));
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <GtkBox spacing={8}>
                <GtkEntry
                    text={inputText}
                    placeholderText="Add email recipient..."
                    hexpand
                    inputPurpose={Gtk.InputPurpose.EMAIL}
                    onChanged={(entry) => {
                        setInputText(entry.getText());
                        setError("");
                    }}
                    onActivate={addEmail}
                />
                <GtkButton label="Add" onClicked={addEmail} />
            </GtkBox>

            {error && <GtkLabel label={error} cssClasses={["error"]} halign={Gtk.Align.START} />}

            <GtkFlowBox columnSpacing={8} rowSpacing={8} selectionMode={Gtk.SelectionMode.NONE}>
                {emails.map((email) => (
                    <GtkButton
                        key={email}
                        label={`${email} x`}
                        cssClasses={["pill"]}
                        onClicked={() => removeEmail(email)}
                    />
                ))}
            </GtkFlowBox>
        </GtkBox>
    );
};

export const taggedEntryDemo: Demo = {
    id: "tagged-entry",
    title: "Tagged Entry",
    description: "Entry with tag/chip inputs for multiple values.",
    keywords: ["tag", "chip", "entry", "multi", "input", "tokens"],
    component: TaggedEntryDemo,
    sourceCode,
};
