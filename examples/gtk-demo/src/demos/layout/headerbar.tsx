import { GtkBox, GtkButton, GtkHeaderBar, GtkSwitch, GtkTextView } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./headerbar.tsx?raw";

const HeaderBarTitlebar = () => (
    <GtkHeaderBar name="headerbar-titlebar">
        <GtkHeaderBar.PackStart>
            <GtkBox name="nav-box" cssClasses={["linked"]}>
                <GtkButton name="back-button" iconName="go-previous-symbolic" tooltipText="Back" />
                <GtkButton name="forward-button" iconName="go-next-symbolic" tooltipText="Forward" />
            </GtkBox>
        </GtkHeaderBar.PackStart>
        <GtkHeaderBar.PackStart>
            <GtkSwitch accessibleLabel="Change something" />
        </GtkHeaderBar.PackStart>
        <GtkHeaderBar.PackEnd>
            <GtkButton name="check-out-button" iconName="mail-send-receive-symbolic" tooltipText="Check out" />
        </GtkHeaderBar.PackEnd>
    </GtkHeaderBar>
);

const HeaderBarDemo = () => <GtkTextView name="text-view" accessibleLabel="Content" />;

export const headerbarDemo: Demo = {
    id: "headerbar",
    title: "Header Bar",
    description:
        "GtkHeaderBar is a container that is suitable for implementing window titlebars. One of its features is that it can position a title centered with regard to the full width, regardless of variable-width content at the left or right.\n\nIt is commonly used with gtk_window_set_titlebar()",
    keywords: ["GtkWindowHandle", "GtkWindowControls"],
    component: HeaderBarDemo,
    titlebar: HeaderBarTitlebar,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
    windowTitle: "Welcome to the Hotel California",
};
