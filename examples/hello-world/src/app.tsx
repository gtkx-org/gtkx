import * as Gtk from "@gtkx/gi/gtk";
import { AdwApplication, AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { quit } from "@gtkx/react";
import { useState } from "react";

const Counter = () => {
    const [count, setCount] = useState(0);

    return (
        <AdwApplicationWindow title="Hello GTKX" defaultWidth={400} defaultHeight={300} onCloseRequest={quit}>
            <AdwToolbarView topBar={<AdwHeaderBar />}>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={20}
                    marginTop={40}
                    marginBottom={40}
                    marginStart={40}
                    marginEnd={40}
                    valign={Gtk.Align.CENTER}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkLabel cssClasses={["title-1"]}>Welcome to GTKX!</GtkLabel>
                    <GtkLabel cssClasses={["title-2"]}>{`Count: ${String(count)}`}</GtkLabel>
                    <GtkButton
                        label="Increment"
                        onClicked={() => {
                            setCount((c) => c + 1);
                        }}
                        cssClasses={["suggested-action", "pill"]}
                    />
                </GtkBox>
            </AdwToolbarView>
        </AdwApplicationWindow>
    );
};

const App = () => (
    <AdwApplication>
        <Counter />
    </AdwApplication>
);

export { App };
