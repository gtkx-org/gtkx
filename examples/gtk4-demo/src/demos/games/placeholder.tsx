import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const GamesPlaceholderDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Games" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About Games" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="This category showcases interactive games built with GTKX, demonstrating how React state management and GTK widgets combine to create engaging experiences."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Available Demos" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`• 15 Puzzle - Classic sliding tile puzzle game
• Memory Game - Card matching memory challenge`}
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Key Techniques" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`- React useState for game state management
- GtkBox layout with homogeneous prop for tile grids
- CSS-in-JS for dynamic styling
- useCallback for optimized event handlers
- useEffect for game logic side effects`}
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const gamesPlaceholderDemo: Demo = {
    id: "games-overview",
    title: "Games Overview",
    description: "Interactive games built with GTKX and React.",
    keywords: ["games", "puzzle", "interactive", "react", "state"],
    component: GamesPlaceholderDemo,
    sourcePath: getSourcePath(import.meta.url, "placeholder.tsx"),
};
