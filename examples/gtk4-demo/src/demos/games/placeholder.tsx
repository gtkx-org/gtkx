import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const GamesPlaceholderDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="Games" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="About Games" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="This category showcases interactive games built with GTKX, demonstrating how React state management and GTK widgets combine to create engaging experiences."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Available Demos" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="• 15 Puzzle - Classic sliding tile puzzle game\n• Memory Game - Card matching memory challenge"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Key Techniques" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="- React useState for game state management\n- Box layout with homogeneous prop for tile grids\n- CSS-in-JS for dynamic styling\n- useCallback for optimized event handlers\n- useEffect for game logic side effects"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
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
