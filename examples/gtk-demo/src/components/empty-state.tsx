import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";

type EmptyStateProps = {
    message: string;
};

const EmptyState = ({ message }: EmptyStateProps) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER} vexpand>
        <GtkLabel cssClasses={["dim-label"]}>{message}</GtkLabel>
    </GtkBox>
);

export { EmptyState };
