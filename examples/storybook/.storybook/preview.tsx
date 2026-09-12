import type { Preview } from "@gtkx/storybook";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwClamp } from "@gtkx/jsx/adw";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";

const preview = {
    initialGlobals: { collection: "GTKX component gallery" },
    decorators: [
        (Story, context) => {
            const gtkx = context.parameters.gtkx;

            if (typeof gtkx === "object" && gtkx !== null && "preview" in gtkx && gtkx.preview === "window") {
                return <Story />;
            }

            return (
                <AdwClamp maximumSize={540}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24} marginTop={24} marginBottom={24}>
                        <GtkLabel label={String(context.globals.collection)} cssClasses={["dim-label"]} />
                        <Story />
                    </GtkBox>
                </AdwClamp>
            );
        },
    ],
} satisfies Preview;

export default preview;
