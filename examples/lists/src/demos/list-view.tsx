import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkListView, GtkScrolledWindow } from "@gtkx/react";

interface Contact {
    id: string;
    name: string;
    email: string;
    department: string;
}

const contacts: Contact[] = [
    { id: "1", name: "Alice Johnson", email: "alice@company.com", department: "Engineering" },
    { id: "2", name: "Bob Smith", email: "bob@company.com", department: "Design" },
    { id: "3", name: "Carol Williams", email: "carol@company.com", department: "Marketing" },
    { id: "4", name: "David Brown", email: "david@company.com", department: "Engineering" },
    { id: "5", name: "Eve Davis", email: "eve@company.com", department: "Sales" },
    { id: "6", name: "Frank Miller", email: "frank@company.com", department: "Engineering" },
    { id: "7", name: "Grace Wilson", email: "grace@company.com", department: "Design" },
    { id: "8", name: "Henry Taylor", email: "henry@company.com", department: "Marketing" },
    { id: "9", name: "Ivy Anderson", email: "ivy@company.com", department: "Engineering" },
    { id: "10", name: "Jack Thomas", email: "jack@company.com", department: "Sales" },
    { id: "11", name: "Kate Jackson", email: "kate@company.com", department: "Engineering" },
    { id: "12", name: "Leo White", email: "leo@company.com", department: "Design" },
    { id: "13", name: "Mia Harris", email: "mia@company.com", department: "Marketing" },
    { id: "14", name: "Noah Martin", email: "noah@company.com", department: "Engineering" },
    { id: "15", name: "Olivia Garcia", email: "olivia@company.com", department: "Sales" },
];

export const ListViewDemo = () => {
    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={16}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
            hexpand
            vexpand
        >
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="ListView" cssClasses={["title-1"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkListView is a high-performance widget for displaying large lists using virtual scrolling. Only visible items are rendered, making it efficient for thousands of items."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} vexpand>
                <GtkLabel label="Company Directory" cssClasses={["heading"]} halign={Gtk.Align.START} />

                <GtkScrolledWindow vexpand cssClasses={["card"]}>
                    <GtkListView.Root
                        renderItem={(contact: Contact | null) => (
                            <GtkBox
                                orientation={Gtk.Orientation.HORIZONTAL}
                                spacing={12}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={10}
                                marginBottom={10}
                            >
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={0}
                                    widthRequest={40}
                                    heightRequest={40}
                                    cssClasses={["circular", "accent"]}
                                    halign={Gtk.Align.CENTER}
                                    valign={Gtk.Align.CENTER}
                                >
                                    <GtkLabel
                                        label={contact?.name.charAt(0) ?? "?"}
                                        cssClasses={["title-3"]}
                                        halign={Gtk.Align.CENTER}
                                        valign={Gtk.Align.CENTER}
                                    />
                                </GtkBox>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand>
                                    <GtkLabel label={contact?.name ?? ""} halign={Gtk.Align.START} />
                                    <GtkLabel
                                        label={contact?.email ?? ""}
                                        cssClasses={["dim-label", "caption"]}
                                        halign={Gtk.Align.START}
                                    />
                                </GtkBox>
                                <GtkLabel label={contact?.department ?? ""} cssClasses={["dim-label"]} />
                            </GtkBox>
                        )}
                    >
                        {contacts.map((contact) => (
                            <GtkListView.Item key={contact.id} id={contact.id} item={contact} />
                        ))}
                    </GtkListView.Root>
                </GtkScrolledWindow>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={
                        "• Virtual scrolling for optimal performance\n• Widget recycling reduces memory usage\n• renderItem prop for custom item rendering\n• Works with any data type"
                    }
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};
