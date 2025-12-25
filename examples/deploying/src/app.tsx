import * as Gtk from "@gtkx/ffi/gtk";
import { GtkApplicationWindow, GtkBox, GtkButton, GtkLabel, quit } from "@gtkx/react";
import { useState } from "react";

export const appId = "org.gtkx.flatpak";

export const App = () => {
    const [count, setCount] = useState(0);

    const increment = () => {
        setCount((c) => c + 1);
    };

    return (
        <GtkApplicationWindow title="GTKX Flatpak Demo" defaultWidth={400} defaultHeight={300} onCloseRequest={quit}>
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
                <GtkLabel label="Hello from Flatpak!" cssClasses={["title-1"]} />
                <GtkLabel label={`Count: ${count}`} cssClasses={["title-2"]} name="count-label" />
                <GtkButton label="Increment" onClicked={increment} cssClasses={["suggested-action", "pill"]} />
            </GtkBox>
        </GtkApplicationWindow>
    );
};

export default App;
