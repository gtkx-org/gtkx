import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkListView, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useState } from "react";

interface Track {
    title: string;
    duration: string;
}

const tracks: Track[] = [
    { title: "Overture", duration: "3:12" },
    { title: "First Light", duration: "4:45" },
    { title: "Paper Boats", duration: "2:58" },
    { title: "Northbound", duration: "5:21" },
    { title: "Coda", duration: "3:40" },
];

export const Demo = () => {
    const [selected, setSelected] = useState(["1"]);

    return (
        <GtkScrolledWindow vexpand>
            <GtkListView
                estimatedItemHeight={44}
                selectionMode={Gtk.SelectionMode.SINGLE}
                selected={selected}
                onSelectionChanged={setSelected}
                items={tracks.map((track, index) => ({ id: String(index), value: track }))}
                renderItem={(track: Track) => (
                    <GtkBox spacing={12} marginTop={10} marginBottom={10} marginStart={12} marginEnd={12}>
                        <GtkLabel label={track.title} hexpand halign={Gtk.Align.START} />
                        <GtkLabel label={track.duration} cssClasses={["dim-label", "numeric"]} />
                    </GtkBox>
                )}
            />
        </GtkScrolledWindow>
    );
};
