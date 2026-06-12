import { AdwActionRow } from "@gtkx/jsx/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkImage, GtkListBox, GtkSwitch } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkListBox cssClasses={["boxed-list"]} hexpand>
        <AdwActionRow
            title="Wi-Fi"
            subtitle="Connected to Homenet"
            addPrefix={<GtkImage iconName="network-wireless-symbolic" />}
            addSuffix={<GtkSwitch active valign={Gtk.Align.CENTER} />}
        />
        <AdwActionRow
            title="Bluetooth"
            subtitle="Off"
            addPrefix={<GtkImage iconName="bluetooth-symbolic" />}
            addSuffix={<GtkSwitch valign={Gtk.Align.CENTER} />}
        />
        <AdwActionRow
            title="Location"
            subtitle="Apps may request access"
            addPrefix={<GtkImage iconName="find-location-symbolic" />}
            addSuffix={<GtkImage iconName="go-next-symbolic" />}
        />
    </GtkListBox>
);
