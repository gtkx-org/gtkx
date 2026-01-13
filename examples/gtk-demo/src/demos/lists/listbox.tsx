import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkFrame,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkScrolledWindow,
} from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listbox.tsx?raw";

interface Contact {
    id: number;
    name: string;
    email: string;
    avatar: string;
}

const initialContacts: Contact[] = [
    { id: 1, name: "Alice Johnson", email: "alice@example.com", avatar: "avatar-default-symbolic" },
    { id: 2, name: "Bob Smith", email: "bob@example.com", avatar: "avatar-default-symbolic" },
    { id: 3, name: "Carol Williams", email: "carol@example.com", avatar: "avatar-default-symbolic" },
    { id: 4, name: "David Brown", email: "david@example.com", avatar: "avatar-default-symbolic" },
    { id: 5, name: "Eva Martinez", email: "eva@example.com", avatar: "avatar-default-symbolic" },
];

const ListBoxDemo = () => {
    const [contacts, setContacts] = useState(initialContacts);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [nextId, setNextId] = useState(6);

    const addContact = () => {
        const newContact: Contact = {
            id: nextId,
            name: `New Contact ${nextId}`,
            email: `contact${nextId}@example.com`,
            avatar: "avatar-default-symbolic",
        };
        setContacts([...contacts, newContact]);
        setNextId(nextId + 1);
    };

    const removeContact = (id: number) => {
        setContacts(contacts.filter((c) => c.id !== id));
        if (selectedId === id) {
            setSelectedId(null);
        }
    };

    const handleRowSelected = (_listBox: Gtk.ListBox, row: Gtk.ListBoxRow | null) => {
        if (row) {
            const index = row.getIndex();
            const contact = contacts[index];
            if (index >= 0 && contact) {
                setSelectedId(contact.id);
            }
        } else {
            setSelectedId(null);
        }
    };

    const selectedContact = contacts.find((c) => c.id === selectedId);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="ListBox" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkListBox is a vertical list container where rows can be selected, activated, and sorted. Each row can contain custom widgets for rich content display."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Contact List">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={8}>
                        <GtkButton label="Add Contact" onClicked={addContact} cssClasses={["suggested-action"]} />
                        <GtkLabel
                            label={`${contacts.length} contacts`}
                            cssClasses={["dim-label"]}
                            valign={Gtk.Align.CENTER}
                            hexpand
                            halign={Gtk.Align.END}
                        />
                    </GtkBox>

                    <GtkScrolledWindow
                        heightRequest={320}
                        hscrollbarPolicy={Gtk.PolicyType.NEVER}
                        cssClasses={["card"]}
                    >
                        <GtkListBox onRowSelected={handleRowSelected} cssClasses={["boxed-list"]}>
                            {contacts.map((contact) => (
                                <GtkListBoxRow key={contact.id}>
                                    <GtkBox spacing={12} marginTop={8} marginBottom={8} marginStart={12} marginEnd={12}>
                                        <GtkImage iconName={contact.avatar} pixelSize={40} />
                                        <GtkBox
                                            orientation={Gtk.Orientation.VERTICAL}
                                            spacing={4}
                                            hexpand
                                            valign={Gtk.Align.CENTER}
                                        >
                                            <GtkLabel label={contact.name} halign={Gtk.Align.START} />
                                            <GtkLabel
                                                label={contact.email}
                                                cssClasses={["dim-label", "caption"]}
                                                halign={Gtk.Align.START}
                                            />
                                        </GtkBox>
                                        <GtkButton
                                            iconName="edit-delete-symbolic"
                                            cssClasses={["flat", "circular"]}
                                            onClicked={() => removeContact(contact.id)}
                                            valign={Gtk.Align.CENTER}
                                        />
                                    </GtkBox>
                                </GtkListBoxRow>
                            ))}
                        </GtkListBox>
                    </GtkScrolledWindow>

                    {selectedContact && (
                        <GtkBox
                            spacing={8}
                            cssClasses={["card"]}
                            marginTop={8}
                            marginBottom={8}
                            marginStart={12}
                            marginEnd={12}
                        >
                            <GtkLabel label="Selected:" cssClasses={["dim-label"]} />
                            <GtkLabel label={selectedContact.name} />
                            <GtkLabel label={`(${selectedContact.email})`} cssClasses={["dim-label"]} />
                        </GtkBox>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Selection Modes">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="ListBox supports different selection modes: NONE, SINGLE, BROWSE, and MULTIPLE."
                        wrap
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />

                    <GtkBox spacing={16}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} hexpand>
                            <GtkLabel label="SINGLE" cssClasses={["dim-label"]} />
                            <GtkListBox cssClasses={["boxed-list"]}>
                                <GtkListBoxRow>
                                    <GtkLabel
                                        label="Item 1"
                                        marginStart={8}
                                        marginEnd={8}
                                        marginTop={4}
                                        marginBottom={4}
                                    />
                                </GtkListBoxRow>
                                <GtkListBoxRow>
                                    <GtkLabel
                                        label="Item 2"
                                        marginStart={8}
                                        marginEnd={8}
                                        marginTop={4}
                                        marginBottom={4}
                                    />
                                </GtkListBoxRow>
                                <GtkListBoxRow>
                                    <GtkLabel
                                        label="Item 3"
                                        marginStart={8}
                                        marginEnd={8}
                                        marginTop={4}
                                        marginBottom={4}
                                    />
                                </GtkListBoxRow>
                            </GtkListBox>
                        </GtkBox>

                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} hexpand>
                            <GtkLabel label="MULTIPLE" cssClasses={["dim-label"]} />
                            <GtkListBox selectionMode={Gtk.SelectionMode.MULTIPLE} cssClasses={["boxed-list"]}>
                                <GtkListBoxRow>
                                    <GtkLabel
                                        label="Item A"
                                        marginStart={8}
                                        marginEnd={8}
                                        marginTop={4}
                                        marginBottom={4}
                                    />
                                </GtkListBoxRow>
                                <GtkListBoxRow>
                                    <GtkLabel
                                        label="Item B"
                                        marginStart={8}
                                        marginEnd={8}
                                        marginTop={4}
                                        marginBottom={4}
                                    />
                                </GtkListBoxRow>
                                <GtkListBoxRow>
                                    <GtkLabel
                                        label="Item C"
                                        marginStart={8}
                                        marginEnd={8}
                                        marginTop={4}
                                        marginBottom={4}
                                    />
                                </GtkListBoxRow>
                            </GtkListBox>
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Properties" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="selectionMode: NONE, SINGLE, BROWSE, or MULTIPLE. showSeparators: Display dividers between rows. : Activate rows with single click. onRowSelected: Callback when selection changes. onRowActivated: Callback when row is activated."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const listboxDemo: Demo = {
    id: "listbox",
    title: "ListBox",
    description: "Vertical list container with selectable rows and custom content",
    keywords: ["listbox", "list", "rows", "selection", "GtkListBox", "GtkListBoxRow"],
    component: ListBoxDemo,
    sourceCode,
};
