import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkExpander, GtkLabel, GtkScrolledWindow, GtkSearchEntry, Slot } from "@gtkx/react";
import { useDemo } from "../context/demo-context.js";

export const Sidebar = () => {
    const { filteredCategories, currentDemo, selectDemo, setSearchQuery } = useDemo();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand>
            <GtkSearchEntry
                placeholderText="Search demos..."
                onSearchChanged={(entry) => setSearchQuery(entry.getText())}
                marginStart={8}
                marginEnd={8}
                marginTop={8}
                marginBottom={8}
            />
            <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} marginStart={8} marginEnd={8}>
                    {filteredCategories.map((category) => (
                        <GtkExpander key={category.id} label={category.title}>
                            <Slot for={GtkExpander} id="child">
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={4}
                                    marginTop={4}
                                    marginBottom={8}
                                >
                                    {category.demos.map((demo) => (
                                        <GtkButton
                                            key={demo.id}
                                            onClicked={() => selectDemo(category.id, demo.id)}
                                            cssClasses={currentDemo?.id === demo.id ? ["suggested-action"] : ["flat"]}
                                        >
                                            <GtkBox
                                                orientation={Gtk.Orientation.VERTICAL}
                                                spacing={2}
                                                marginStart={8}
                                                marginEnd={8}
                                                marginTop={4}
                                                marginBottom={4}
                                            >
                                                <GtkLabel label={demo.title} halign={Gtk.Align.START} />
                                                <GtkLabel
                                                    label={demo.description}
                                                    halign={Gtk.Align.START}
                                                    cssClasses={["dim-label", "caption"]}
                                                    ellipsize={3}
                                                />
                                            </GtkBox>
                                        </GtkButton>
                                    ))}
                                </GtkBox>
                            </Slot>
                        </GtkExpander>
                    ))}
                </GtkBox>
            </GtkScrolledWindow>
        </GtkBox>
    );
};
