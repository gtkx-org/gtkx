import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label } from "@gtkx/gtkx";
import type { Demo } from "../types.js";

export const GamesPlaceholderDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Games" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About Games" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="This category showcases interactive games built with GTKX, demonstrating how React state management and GTK widgets combine to create engaging experiences."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Available Demos" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="• 15 Puzzle - Classic sliding tile puzzle game\n• Memory Game - Card matching memory challenge"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Key Techniques" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
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
    source: `// Games are built using React state management with GTK widgets
// Key patterns:
// - useState for game state (board, moves, etc.)
// - Box with homogeneous prop for tile-based layouts
// - useCallback for click handlers
// - CSS-in-JS for dynamic styling

const [board, setBoard] = useState(initialBoard);
const [moves, setMoves] = useState(0);

const handleMove = useCallback((index) => {
    // Update game state
    setBoard(newBoard);
    setMoves(m => m + 1);
}, [board]);`,
};
