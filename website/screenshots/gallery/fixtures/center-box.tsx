import { GtkButton, GtkCenterBox, GtkLabel } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkCenterBox
        hexpand
        startWidget={<GtkButton iconName="go-previous-symbolic" />}
        centerWidget={<GtkLabel label="Centered title" cssClasses={["title-4"]} />}
        endWidget={<GtkButton iconName="open-menu-symbolic" />}
    />
);
