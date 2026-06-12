import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkCheckButton } from "@gtkx/jsx/gtk";
import { useRef, useState } from "react";

export const Demo = () => {
    const [notify, setNotify] = useState(true);
    const groupRef = useRef<Gtk.CheckButton | null>(null);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <GtkCheckButton label="Enable notifications" active={notify} onToggled={() => setNotify(!notify)} />
            <GtkCheckButton ref={groupRef} label="Every hour" active />
            <GtkCheckButton label="Once a day" group={groupRef.current} />
            <GtkCheckButton label="Never" group={groupRef.current} />
        </GtkBox>
    );
};
