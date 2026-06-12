import * as Gtk from "@gtkx/gi/gtk";
import { GtkFlowBox, GtkLabel } from "@gtkx/jsx/gtk";

const tags = ["GTK4", "Libadwaita", "React 19", "TypeScript", "Node.js", "Vite", "Vitest", "CSS-in-JS"];

export const Demo = () => (
    <GtkFlowBox maxChildrenPerLine={4} columnSpacing={8} rowSpacing={8} selectionMode={Gtk.SelectionMode.NONE}>
        {tags.map((tag) => (
            <GtkLabel key={tag} label={tag} cssClasses={["pill", "frame"]} marginTop={4} marginBottom={4} />
        ))}
    </GtkFlowBox>
);
