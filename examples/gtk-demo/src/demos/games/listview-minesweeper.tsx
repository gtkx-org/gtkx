import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkScrolledWindow, x } from "@gtkx/react";
import { useCallback, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-minesweeper.tsx?raw";

const GRID_SIZE = 10;
const MINE_COUNT = 15;

interface Cell {
    id: string;
    row: number;
    col: number;
    isMine: boolean;
    isRevealed: boolean;
    isFlagged: boolean;
    adjacentMines: number;
}

type GameState = "playing" | "won" | "lost";

const createBoard = (): Cell[] => {
    const cells: Cell[] = [];

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            cells.push({
                id: `${row}-${col}`,
                row,
                col,
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                adjacentMines: 0,
            });
        }
    }

    let minesPlaced = 0;
    while (minesPlaced < MINE_COUNT) {
        const index = Math.floor(Math.random() * cells.length);
        const cell = cells[index];
        if (cell && !cell.isMine) {
            cell.isMine = true;
            minesPlaced++;
        }
    }

    for (const cell of cells) {
        if (cell.isMine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = cell.row + dr;
                const nc = cell.col + dc;
                if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
                    const neighbor = cells[nr * GRID_SIZE + nc];
                    if (neighbor?.isMine) count++;
                }
            }
        }
        cell.adjacentMines = count;
    }

    return cells;
};

const ListViewMinesweeperDemo = () => {
    const [board, setBoard] = useState<Cell[]>(createBoard);
    const [gameState, setGameState] = useState<GameState>("playing");
    const [flagCount, setFlagCount] = useState(0);
    const [startTime, setStartTime] = useState<number | null>(null);

    const revealCell = useCallback((index: number, currentBoard: Cell[]): Cell[] => {
        const cell = currentBoard[index];
        if (!cell || cell.isRevealed || cell.isFlagged) return currentBoard;

        const newBoard = [...currentBoard];
        const newCell = { ...cell, isRevealed: true };
        newBoard[index] = newCell;

        if (newCell.isMine) {
            return newBoard;
        }

        if (newCell.adjacentMines === 0) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = newCell.row + dr;
                    const nc = newCell.col + dc;
                    if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
                        const neighborIndex = nr * GRID_SIZE + nc;
                        const neighbor = newBoard[neighborIndex];
                        if (neighbor && !neighbor.isRevealed && !neighbor.isFlagged) {
                            const result = revealCell(neighborIndex, newBoard);
                            for (let i = 0; i < result.length; i++) {
                                newBoard[i] = result[i] ?? newBoard[i] ?? cell;
                            }
                        }
                    }
                }
            }
        }

        return newBoard;
    }, []);

    const handleCellClick = useCallback(
        (index: number) => {
            if (gameState !== "playing") return;

            const cell = board[index];
            if (!cell || cell.isRevealed || cell.isFlagged) return;

            if (startTime === null) {
                setStartTime(Date.now());
            }

            const newBoard = revealCell(index, board);
            setBoard(newBoard);

            const clickedCell = newBoard[index];
            if (clickedCell?.isMine) {
                setGameState("lost");
                setBoard(newBoard.map((c) => (c.isMine ? { ...c, isRevealed: true } : c)));
                return;
            }

            const unrevealedSafeCells = newBoard.filter((c) => !c.isRevealed && !c.isMine).length;
            if (unrevealedSafeCells === 0) {
                setGameState("won");
            }
        },
        [board, gameState, startTime, revealCell],
    );

    const resetGame = useCallback(() => {
        setBoard(createBoard());
        setGameState("playing");
        setFlagCount(0);
        setStartTime(null);
    }, []);

    const getCellDisplay = (cell: Cell): string => {
        if (cell.isFlagged) return "F";
        if (!cell.isRevealed) return "";
        if (cell.isMine) return "X";
        if (cell.adjacentMines === 0) return "";
        return String(cell.adjacentMines);
    };

    const getCellClasses = (cell: Cell): string[] => {
        const classes: string[] = [];
        if (cell.isRevealed) {
            if (cell.isMine) {
                classes.push("error");
            }
        } else {
            classes.push("card");
        }
        if (cell.isFlagged) {
            classes.push("warning");
        }
        return classes;
    };

    const revealedCount = board.filter((c) => c.isRevealed).length;
    const totalSafeCells = GRID_SIZE * GRID_SIZE - MINE_COUNT;

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Minesweeper" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Classic Minesweeper game implemented using GridView. Click cells to reveal them. Double-click or activate to reveal. Numbers show adjacent mine count. Avoid the mines!"
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Game Status">
                <GtkBox
                    spacing={24}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                        <GtkLabel label="Mines" cssClasses={["dim-label"]} />
                        <GtkLabel label={String(MINE_COUNT - flagCount)} cssClasses={["title-1"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                        <GtkLabel label="Status" cssClasses={["dim-label"]} />
                        <GtkLabel
                            label={gameState === "won" ? "YOU WIN!" : gameState === "lost" ? "GAME OVER" : "Playing..."}
                            cssClasses={
                                gameState === "won"
                                    ? ["title-2", "success"]
                                    : gameState === "lost"
                                      ? ["title-2", "error"]
                                      : ["title-2"]
                            }
                        />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                        <GtkLabel label="Progress" cssClasses={["dim-label"]} />
                        <GtkLabel
                            label={`${Math.min(revealedCount, totalSafeCells)}/${totalSafeCells}`}
                            cssClasses={["title-1"]}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Minefield">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER} vscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <x.GridView<Cell>
                            estimatedItemHeight={44}
                            minColumns={GRID_SIZE}
                            maxColumns={GRID_SIZE}
                            onActivate={(_grid, position) => handleCellClick(position)}
                            renderItem={(item) => (
                                <GtkButton
                                    label={getCellDisplay(
                                        item ?? {
                                            id: "",
                                            row: 0,
                                            col: 0,
                                            isMine: false,
                                            isRevealed: false,
                                            isFlagged: false,
                                            adjacentMines: 0,
                                        },
                                    )}
                                    widthRequest={40}
                                    heightRequest={40}
                                    cssClasses={getCellClasses(
                                        item ?? {
                                            id: "",
                                            row: 0,
                                            col: 0,
                                            isMine: false,
                                            isRevealed: false,
                                            isFlagged: false,
                                            adjacentMines: 0,
                                        },
                                    )}
                                    sensitive={gameState === "playing" && !(item?.isRevealed ?? false)}
                                    onClicked={() => {
                                        const index = board.findIndex((c) => c.id === item?.id);
                                        if (index !== -1) handleCellClick(index);
                                    }}
                                />
                            )}
                        >
                            {board.map((cell) => (
                                <x.ListItem key={cell.id} id={cell.id} value={cell} />
                            ))}
                        </x.GridView>
                    </GtkScrolledWindow>
                </GtkBox>
            </GtkFrame>

            <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
                <GtkButton label="New Game" onClicked={resetGame} cssClasses={["suggested-action"]} />
            </GtkBox>

            {gameState !== "playing" && (
                <GtkFrame>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={8}
                        marginTop={16}
                        marginBottom={16}
                        marginStart={16}
                        marginEnd={16}
                        halign={Gtk.Align.CENTER}
                    >
                        <GtkLabel
                            label={gameState === "won" ? "Congratulations!" : "Better luck next time!"}
                            cssClasses={["title-1"]}
                        />
                        <GtkLabel
                            label={gameState === "won" ? `You cleared the minefield!` : "You hit a mine!"}
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>
                </GtkFrame>
            )}

            <GtkFrame label="How to Play">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel label="1. Click a cell to reveal it" halign={Gtk.Align.START} />
                    <GtkLabel label="2. Numbers show how many adjacent cells contain mines" halign={Gtk.Align.START} />
                    <GtkLabel label="3. Empty cells automatically reveal their neighbors" halign={Gtk.Align.START} />
                    <GtkLabel label="4. Reveal all safe cells to win - avoid the mines!" halign={Gtk.Align.START} />
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Implementation Notes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Uses GridView with fixed column count to create a game grid. Each cell is a button that reveals on click. The flood-fill algorithm for empty cells uses recursive state updates. Game state tracks win/lose conditions."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const listviewMinesweeperDemo: Demo = {
    id: "listview-minesweeper",
    title: "Minesweeper",
    description: "Classic Minesweeper game using GridView",
    keywords: ["gridview", "minesweeper", "game", "GtkGridView", "grid", "puzzle", "mines"],
    component: ListViewMinesweeperDemo,
    sourceCode,
};
