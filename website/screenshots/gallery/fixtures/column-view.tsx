import * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, GtkColumnViewColumn, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";

interface Release {
    version: string;
    date: string;
    notes: string;
}

const releases: Release[] = [
    { version: "1.0.0", date: "2026-06-20", notes: "The v1 release" },
    { version: "0.21.0", date: "2026-03-26", notes: "useProperty hook" },
    { version: "0.20.0", date: "2026-03-12", notes: "Animation package" },
    { version: "0.19.0", date: "2026-02-27", notes: "Widget gallery" },
];

export const Demo = () => (
    <GtkScrolledWindow vexpand>
        <GtkColumnView
            estimatedRowHeight={40}
            items={releases.map((release) => ({ id: release.version, value: release }))}
        >
            <GtkColumnViewColumn
                id="version"
                title="Version"
                renderCell={(release: Release) => <GtkLabel label={release.version} halign={Gtk.Align.START} />}
            />
            <GtkColumnViewColumn
                id="date"
                title="Date"
                renderCell={(release: Release) => (
                    <GtkLabel label={release.date} halign={Gtk.Align.START} cssClasses={["numeric"]} />
                )}
            />
            <GtkColumnViewColumn
                id="highlights"
                title="Highlights"
                expand
                renderCell={(release: Release) => (
                    <GtkLabel label={release.notes} halign={Gtk.Align.START} cssClasses={["dim-label"]} />
                )}
            />
        </GtkColumnView>
    </GtkScrolledWindow>
);
