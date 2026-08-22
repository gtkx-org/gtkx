import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";

type PageProps = {
    children: ReactNode;
};

const Page = ({ children }: PageProps): ReactNode => (
    <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={12}
            marginTop={24}
            marginBottom={24}
            marginStart={24}
            marginEnd={24}
            valign={Gtk.Align.START}
        >
            {children}
        </GtkBox>
    </GtkScrolledWindow>
);

export { Page };
