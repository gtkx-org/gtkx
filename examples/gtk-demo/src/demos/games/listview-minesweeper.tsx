import { GridView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkHeaderBar, GtkImage, GtkLabel } from "@gtkx/jsx/gtk";
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
        "This demo shows how to develop a user interface for small game using a grid view.\n\nIt demonstrates how " +
        "to use the activate signal and single-press behavior to implement rather different interaction behavior to " +
        "a typical list.",
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

const randomIndex = (limit: number): number => {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);

    return Math.floor(((buffer[0] ?? 0) / 2 ** 32) * limit);
};

const placeMines = (cells: Cell[]): void => {
    let minesPlaced = 0;

    while (minesPlaced < MINE_COUNT) {
        const cell = cells[randomIndex(cells.length)];

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

const revealCell = (index: number, currentBoard: Cell[]): Cell[] => {
    const cell = currentBoard[index];

    if (!cell || cell.isRevealed) {
        return currentBoard;
    }

    const newBoard = [...currentBoard];
    newBoard[index] = { ...cell, isRevealed: true };

    return newBoard;
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

const evaluateBoard = (board: Cell[], index: number): "won" | "lost" | "continue" => {
    const clickedCell = board[index];

    if (clickedCell?.isMine) {
        return "lost";
    }

    const unrevealedSafeCells = board.filter((c) => !c.isRevealed && !c.isMine).length;

    return unrevealedSafeCells === 0 ? "won" : "continue";
};

const resolveCellClick = (board: Cell[], gameState: GameState, index: number): CellClickOutcome | null => {
    const cell = board[index];

    if (gameState !== "playing" || !cell || cell.isRevealed) {
        return null;
    }

    const nextBoard = revealCell(index, board);
    const result = evaluateBoard(nextBoard, index);

    return { board: nextBoard, gameState: result === "continue" ? gameState : result };
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
            titleWidget={gameState === "won" ? <GtkImage iconName="trophy-gold" /> : null}
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
                singleClickActivate
                onActivate={(position) => {
                    handleCellClick(position);
                }}
                renderItem={({ item }: { item: Cell }) => (
                    <GtkLabel halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} widthRequest={32} heightRequest={32}>
                        {getCellDisplay(item)}
                    </GtkLabel>
                )}
                items={board.map((cell) => ({ id: cell.id, value: cell }))}
            />
        </GtkBox>
    );
}

export { listviewMinesweeperDemo };
