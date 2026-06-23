import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { quit } from "@gtkx/react";
import { useState } from "react";

const Counter = () => {
    const [count, setCount] = useState(0);

    return (
        <GtkApplicationWindow
            title="Hello GTKX"
            defaultWidth={400}
            defaultHeight={300}
            onCloseRequest={() => {
                quit();
                return true;
            }}
        >
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
                <GtkLabel label="Welcome to GTKX!" cssClasses={["title-1"]} />
                <GtkLabel label={`Count: ${count}`} cssClasses={["title-2"]} />
                <GtkButton
                    label="Increment"
                    onClicked={() => setCount((c) => c + 1)}
                    cssClasses={["suggested-action", "pill"]}
                />
            </GtkBox>
        </GtkApplicationWindow>
    );
};

export const App = () => (
    <GtkApplication>
        <Counter />
    </GtkApplication>
);
