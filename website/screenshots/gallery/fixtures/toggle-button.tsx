import { GtkBox, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useState } from "react";

export const Demo = () => {
    const [bold, setBold] = useState(true);
    const [italic, setItalic] = useState(false);

    return (
        <GtkBox cssClasses={["linked"]}>
            <GtkToggleButton iconName="format-text-bold-symbolic" active={bold} onToggled={() => setBold(!bold)} />
            <GtkToggleButton
                iconName="format-text-italic-symbolic"
                active={italic}
                onToggled={() => setItalic(!italic)}
            />
            <GtkToggleButton iconName="format-text-underline-symbolic" />
        </GtkBox>
    );
};
