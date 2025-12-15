import { Align, Orientation } from "@gtkx/ffi/gtk";
import { ApplicationWindow, Box, Button, Label, quit } from "@gtkx/react";
import { useState } from "react";

export const appId = "org.gtkx.flatpak";

export const App = () => {
    const [count, setCount] = useState(0);

    const increment = () => {
        setCount((c) => c + 1);
    };

    return (
        <ApplicationWindow title="GTKX Flatpak Demo" defaultWidth={400} defaultHeight={300} onCloseRequest={quit}>
            <Box
                orientation={Orientation.VERTICAL}
                spacing={20}
                marginTop={40}
                marginBottom={40}
                marginStart={40}
                marginEnd={40}
                valign={Align.CENTER}
                halign={Align.CENTER}
            >
                <Label label="Hello from Flatpak!" cssClasses={["title-1"]} />
                <Label label={`Count: ${count}`} cssClasses={["title-2"]} name="count-label" />
                <Button label="Increment" onClicked={increment} cssClasses={["suggested-action", "pill"]} />
            </Box>
        </ApplicationWindow>
    );
};
