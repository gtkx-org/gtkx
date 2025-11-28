import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Expander, Label, ScrolledWindow, SearchEntry } from "@gtkx/gtkx";
import { useState } from "react";
import { useDemo } from "../context/demo-context.js";

export const Sidebar = () => {
    const { filteredCategories, currentDemo, selectDemo, setSearchQuery } = useDemo();
    const [localQuery] = useState("");

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand>
            <SearchEntry
                placeholderText="Search demos..."
                text={localQuery}
                onActivate={() => {
                    setSearchQuery(localQuery);
                }}
                marginStart={8}
                marginEnd={8}
                marginTop={8}
                marginBottom={8}
            />
            <ScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} marginStart={8} marginEnd={8}>
                    {filteredCategories.map((category) => (
                        <Expander.Root key={category.id} label={category.title}>
                            <Expander.Child>
                                <Box orientation={Gtk.Orientation.VERTICAL} spacing={4} marginTop={4} marginBottom={8}>
                                    {category.demos.map((demo) => (
                                        <Button
                                            key={demo.id}
                                            onClicked={() => selectDemo(category.id, demo.id)}
                                            cssClasses={currentDemo?.id === demo.id ? ["suggested-action"] : ["flat"]}
                                        >
                                            <Box
                                                orientation={Gtk.Orientation.VERTICAL}
                                                spacing={2}
                                                marginStart={8}
                                                marginEnd={8}
                                                marginTop={4}
                                                marginBottom={4}
                                            >
                                                <Label.Root label={demo.title} halign={Gtk.Align.START} />
                                                <Label.Root
                                                    label={demo.description}
                                                    halign={Gtk.Align.START}
                                                    cssClasses={["dim-label", "caption"]}
                                                    ellipsize={3}
                                                />
                                            </Box>
                                        </Button>
                                    ))}
                                </Box>
                            </Expander.Child>
                        </Expander.Root>
                    ))}
                </Box>
            </ScrolledWindow>
        </Box>
    );
};
