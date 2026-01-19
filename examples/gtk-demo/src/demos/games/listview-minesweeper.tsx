import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkImage, GtkLabel, x } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SYSTEM_SOUNDS, useSound } from "../../hooks/index.js";
import type { Demo } from "../types.js";
import sourceCode from "./listview-minesweeper.tsx?raw";

const GRID_SIZE = 8;
const MINE_COUNT = 10;

interface Cell {
    id: string;
    row: number;
    col: number;
    isMine: boolean;
    isRevealed: boolean;
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

const defaultCell: Cell = {
    id: "",
    row: 0,
    col: 0,
    isMine: false,
    isRevealed: false,
    adjacentMines: 0,
};

const ListViewMinesweeperDemo = () => {
    const [board, setBoard] = useState<Cell[]>(createBoard);
    const [gameState, setGameState] = useState<GameState>("playing");
    const prevGameState = useRef<GameState>("playing");

    const clickSound = useSound(SYSTEM_SOUNDS.click, { volume: 0.5 });
    const explosionSound = useSound(SYSTEM_SOUNDS.error, { volume: 0.8 });
    const victorySound = useSound(SYSTEM_SOUNDS.complete, { volume: 0.8 });

    useEffect(() => {
        if (prevGameState.current === "playing" && gameState === "lost") {
            explosionSound.play();
        } else if (prevGameState.current === "playing" && gameState === "won") {
            victorySound.play();
        }
        prevGameState.current = gameState;
    }, [gameState, explosionSound, victorySound]);

    const revealCell = useCallback((index: number, currentBoard: Cell[]): Cell[] => {
        const cell = currentBoard[index];
        if (!cell || cell.isRevealed) return currentBoard;

        const newBoard = [...currentBoard];
        newBoard[index] = { ...cell, isRevealed: true };
        return newBoard;
    }, []);

    const handleCellClick = useCallback(
        (index: number) => {
            if (gameState !== "playing") return;

            const cell = board[index];
            if (!cell || cell.isRevealed) return;

            clickSound.play();

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
        [board, gameState, revealCell, clickSound],
    );

    const resetGame = useCallback(() => {
        setBoard(createBoard());
        setGameState("playing");
    }, []);

    const getCellDisplay = (cell: Cell): string => {
        if (!cell.isRevealed) return "?";
        if (cell.isMine) return "💣";
        if (cell.adjacentMines === 0) return "";
        return String(cell.adjacentMines);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
                <GtkButton label="New Game" onClicked={resetGame} />
                {gameState === "won" && <GtkImage iconName="trophy-gold" />}
            </GtkBox>

            <GtkBox halign={Gtk.Align.CENTER}>
                <x.GridView<Cell>
                    estimatedItemHeight={32}
                    minColumns={GRID_SIZE}
                    maxColumns={GRID_SIZE}
                    onActivate={(_grid, position) => handleCellClick(position)}
                    renderItem={(item) => (
                        <GtkLabel
                            label={getCellDisplay(item ?? defaultCell)}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            widthRequest={32}
                            heightRequest={32}
                        />
                    )}
                >
                    {board.map((cell) => (
                        <x.ListItem key={cell.id} id={cell.id} value={cell} />
                    ))}
                </x.GridView>
            </GtkBox>
        </GtkBox>
    );
};

export const listviewMinesweeperDemo: Demo = {
    id: "listview-minesweeper",
    title: "Lists/Minesweeper",
    description:
        "Classic Minesweeper game using GridView. Click cells to reveal them. Numbers show adjacent mine count.",
    keywords: ["gridview", "minesweeper", "game", "GtkGridView", "grid", "puzzle", "mines"],
    component: ListViewMinesweeperDemo,
    sourceCode,
};
