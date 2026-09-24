import { GridView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkHeaderBar, GtkImage, GtkLabel } from "@gtkx/jsx/gtk";
import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { createContext, useContext, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./listview-minesweeper.tsx?raw";

type Cell = {
    id: string;
    row: number;
    col: number;
    isMine: boolean;
    isRevealed: boolean;
    adjacentMines: number;
};

type GameState = "playing" | "won" | "lost";

type CellClickOutcome = {
    board: Cell[];
    gameState: GameState;
};

type MinesweeperContextValue = {
    board: Cell[];
    gameState: GameState;
    handleCellClick: (index: number) => void;
    resetGame: () => void;
};

const GRID_SIZE = 8;
const MINE_COUNT = 10;

const NEIGHBOR_OFFSETS: [number, number][] = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
];

const MinesweeperContext = createContext<MinesweeperContextValue | null>(null);

const listviewMinesweeperDemo: Demo = {
    id: "listview-minesweeper",
    title: "Lists/Minesweeper",
    description:
        "This demo shows how to build a small game with a grid view.\n\nIt uses the activate signal and single-press " +
        "behavior to provide interaction that differs from a typical list.",
    keywords: ["GtkGridView", "GListModel", "game"],
    component: ListViewMinesweeperDemo,
    titlebar: ListViewMinesweeperTitlebar,
    provider: MinesweeperProvider,
    sourceCode,
};

const createEmptyCells = (): Cell[] => {
    const cells: Cell[] = [];

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            cells.push({
                id: `${String(row)}-${String(col)}`,
                row,
                col,
                isMine: false,
                isRevealed: false,
                adjacentMines: 0,
            });
        }
    }

    return cells;
};

const placeMines = (cells: Cell[]): void => {
    let minesPlaced = 0;

    while (minesPlaced < MINE_COUNT) {
        const cell = cells[randomInt(cells.length)];

        if (cell && !cell.isMine) {
            cell.isMine = true;
            minesPlaced++;
        }
    }
};

const isMineAt = (cells: Cell[], row: number, col: number): boolean => {
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
        return false;
    }

    return cells[row * GRID_SIZE + col]?.isMine === true;
};

const countAdjacentMines = (cells: Cell[], cell: Cell): number =>
    NEIGHBOR_OFFSETS.filter(([dr, dc]) => isMineAt(cells, cell.row + dr, cell.col + dc)).length;

const createBoard = (): Cell[] => {
    const cells = createEmptyCells();
    placeMines(cells);

    for (const cell of cells) {
        if (!cell.isMine) {
            cell.adjacentMines = countAdjacentMines(cells, cell);
        }
    }

    return cells;
};

const playGameSound = (didWin: boolean, soundStreamRef: React.RefObject<Gtk.MediaFile | null>) => {
    const dataDirs = (process.env.XDG_DATA_DIRS ?? "/usr/local/share:/usr/share").split(":");
    const sound = didWin ? "complete.oga" : "suspend-error.oga";

    const path = dataDirs
        .map((dir) => `${dir}/sounds/freedesktop/stereo/${sound}`)
        .find((candidate) => existsSync(candidate));

    if (!path) {
        return;
    }

    const stream = Gtk.MediaFile.newForFilename(path);
    stream.setVolume(1);
    stream.play();
    soundStreamRef.current = stream;
};

const resolveCellClick = (board: Cell[], gameState: GameState, index: number): CellClickOutcome | null => {
    const cell = board[index];

    if (gameState !== "playing" || !cell || cell.isRevealed) {
        return null;
    }

    const nextBoard = board.map((current, position) =>
        position === index ? { ...current, isRevealed: true } : current,
    );
    let nextGameState: GameState = "playing";

    if (cell.isMine) {
        nextGameState = "lost";
    } else if (nextBoard.every((current) => current.isMine || current.isRevealed)) {
        nextGameState = "won";
    }

    return { board: nextBoard, gameState: nextGameState };
};

const getCellDisplay = (cell: Cell): string => {
    if (!cell.isRevealed) {
        return "?";
    }

    if (cell.isMine) {
        return "\u{1F4A3}";
    }

    if (cell.adjacentMines === 0) {
        return "";
    }

    return String(cell.adjacentMines);
};

const getCellAccessibleLabel = (cell: Cell): string => {
    const position = `Row ${String(cell.row + 1)}, column ${String(cell.col + 1)}`;

    if (!cell.isRevealed) {
        return `${position}, hidden`;
    }

    if (cell.isMine) {
        return `${position}, mine`;
    }

    if (cell.adjacentMines === 0) {
        return `${position}, empty`;
    }

    const mines = cell.adjacentMines === 1 ? "mine" : "mines";

    return `${position}, ${String(cell.adjacentMines)} adjacent ${mines}`;
};

const useMinesweeperContext = (): MinesweeperContextValue => {
    const ctx = useContext(MinesweeperContext);

    if (!ctx) {
        throw new Error("MinesweeperContext is missing");
    }

    return ctx;
};

function MinesweeperProvider({ children }: DemoProviderProps) {
    const [board, setBoard] = useState<Cell[]>(createBoard);
    const [gameState, setGameState] = useState<GameState>("playing");
    const soundStreamRef = useRef<Gtk.MediaFile | null>(null);

    const handleCellClick = (index: number) => {
        const outcome = resolveCellClick(board, gameState, index);

        if (!outcome) {
            return;
        }

        setBoard(outcome.board);
        setGameState(outcome.gameState);

        if (outcome.gameState !== "playing") {
            playGameSound(outcome.gameState === "won", soundStreamRef);
        }
    };

    const resetGame = () => {
        setBoard(createBoard());
        setGameState("playing");
    };

    const value = {
        board,
        gameState,
        handleCellClick,
        resetGame,
    };

    return <MinesweeperContext.Provider value={value}>{children}</MinesweeperContext.Provider>;
}

function ListViewMinesweeperTitlebar() {
    const { gameState, resetGame } = useMinesweeperContext();

    return (
        <GtkHeaderBar
            name="minesweeper-header"
            titleWidget={gameState === "won" ? <GtkImage iconName="trophy-gold" accessibleLabel="Game won" /> : null}
            start={<GtkButton label="New Game" onClicked={resetGame} />}
        />
    );
}

function ListViewMinesweeperDemo() {
    const { board, handleCellClick } = useMinesweeperContext();

    return (
        <GtkBox halign={Gtk.Align.CENTER}>
            <GridView
                name="grid-view"
                estimatedItemHeight={32}
                minColumns={GRID_SIZE}
                maxColumns={GRID_SIZE}
                selectionMode={Gtk.SelectionMode.NONE}
                singleClickActivate
                onActivate={handleCellClick}
                renderItem={({ item }: { item: Cell }) => (
                    <GtkLabel
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                        widthRequest={32}
                        heightRequest={32}
                        accessibleLabel={getCellAccessibleLabel(item)}
                    >
                        {getCellDisplay(item)}
                    </GtkLabel>
                )}
                items={board.map((cell) => ({ id: cell.id, value: cell }))}
            />
        </GtkBox>
    );
}

export { listviewMinesweeperDemo };
