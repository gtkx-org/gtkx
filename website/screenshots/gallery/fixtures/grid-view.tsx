import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkGridView, GtkImage, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";

const folders = ["Documents", "Music", "Pictures", "Videos", "Downloads", "Projects", "Public", "Archive"];

export const Demo = () => (
    <GtkScrolledWindow vexpand>
        <GtkGridView
            minColumns={4}
            maxColumns={4}
            estimatedItemHeight={96}
            items={folders.map((name) => ({ id: name, value: name }))}
            renderItem={(name: string) => (
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} marginTop={12} marginBottom={12}>
                    <GtkImage iconName="folder-symbolic" pixelSize={40} />
                    <GtkLabel label={name} cssClasses={["caption"]} />
                </GtkBox>
            )}
        />
    </GtkScrolledWindow>
);
