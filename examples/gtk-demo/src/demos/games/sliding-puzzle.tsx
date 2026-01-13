import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkGrid, GtkLabel, x } from "@gtkx/react";
import { useCallback, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./sliding-puzzle.tsx?raw";

const GRID_SIZE = 4;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;

type Board = (number | null)[];

const isSolved = (board: Board): boolean => {
    for (let i = 0; i < TOTAL_TILES - 1; i++) {
        if (board[i] !== i + 1) return false;
    }
    return board[TOTAL_TILES - 1] === null;
};

const getEmptyPosition = (board: Board): number => {
    return board.indexOf(null);
};

const canMove = (index: number, emptyIndex: number): boolean => {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    const emptyRow = Math.floor(emptyIndex / GRID_SIZE);
    const emptyCol = emptyIndex % GRID_SIZE;

    return (Math.abs(row - emptyRow) === 1 && col === emptyCol) || (Math.abs(col - emptyCol) === 1 && row === emptyRow);
};

const shuffleBoard = (): Board => {
    const board: Board = [];
    for (let i = 1; i < TOTAL_TILES; i++) {
        board.push(i);
    }
    board.push(null);

    let emptyIndex = TOTAL_TILES - 1;
    const numMoves = 200;

    for (let i = 0; i < numMoves; i++) {
        const validMoves: number[] = [];
        const emptyRow = Math.floor(emptyIndex / GRID_SIZE);
        const emptyCol = emptyIndex % GRID_SIZE;

        if (emptyRow > 0) validMoves.push(emptyIndex - GRID_SIZE);
        if (emptyRow < GRID_SIZE - 1) validMoves.push(emptyIndex + GRID_SIZE);
        if (emptyCol > 0) validMoves.push(emptyIndex - 1);
        if (emptyCol < GRID_SIZE - 1) validMoves.push(emptyIndex + 1);

        const randomIndex = Math.floor(Math.random() * validMoves.length);
        const moveIndex = validMoves[randomIndex];
        if (moveIndex === undefined) continue;
        board[emptyIndex] = board[moveIndex] ?? null;
        board[moveIndex] = null;
        emptyIndex = moveIndex;
    }

    return board;
};

const SlidingPuzzleDemo = () => {
    const [board, setBoard] = useState<Board>(shuffleBoard);
    const [moves, setMoves] = useState(0);
    const [isWon, setIsWon] = useState(false);

    const handleTileClick = useCallback(
        (index: number) => {
            if (isWon) return;

            const emptyIndex = getEmptyPosition(board);
            if (!canMove(index, emptyIndex)) return;

            const newBoard = [...board];
            newBoard[emptyIndex] = newBoard[index] ?? null;
            newBoard[index] = null;

            setBoard(newBoard);
            setMoves((m) => m + 1);

            if (isSolved(newBoard)) {
                setIsWon(true);
            }
        },
        [board, isWon],
    );

    const handleNewGame = useCallback(() => {
        setBoard(shuffleBoard());
        setMoves(0);
        setIsWon(false);
    }, []);

    const getRow = (index: number) => Math.floor(index / GRID_SIZE);
    const getCol = (index: number) => index % GRID_SIZE;

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Sliding Puzzle" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="The classic 15-puzzle! Slide the numbered tiles to arrange them in order from 1 to 15, with the empty space in the bottom-right corner. Click a tile adjacent to the empty space to move it."
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
                        <GtkLabel label="Moves" cssClasses={["dim-label"]} />
                        <GtkLabel label={String(moves)} cssClasses={["title-1"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                        <GtkLabel label="Status" cssClasses={["dim-label"]} />
                        <GtkLabel
                            label={isWon ? "SOLVED!" : "Playing..."}
                            cssClasses={isWon ? ["title-2", "success"] : ["title-2"]}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Puzzle Board">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkGrid rowSpacing={4} columnSpacing={4}>
                        {board.map((tile, index) => (
                            <x.GridChild key={`tile-${tile ?? "empty"}`} column={getCol(index)} row={getRow(index)}>
                                {tile !== null ? (
                                    <GtkButton
                                        label={String(tile)}
                                        widthRequest={60}
                                        heightRequest={60}
                                        cssClasses={["raised"]}
                                        onClicked={() => handleTileClick(index)}
                                        sensitive={!isWon && canMove(index, getEmptyPosition(board))}
                                    />
                                ) : (
                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        widthRequest={60}
                                        heightRequest={60}
                                    />
                                )}
                            </x.GridChild>
                        ))}
                    </GtkGrid>
                </GtkBox>
            </GtkFrame>

            <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
                <GtkButton label="New Game" onClicked={handleNewGame} cssClasses={["suggested-action"]} />
            </GtkBox>

            {isWon && (
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
                        <GtkLabel label="Congratulations!" cssClasses={["title-1"]} />
                        <GtkLabel label={`You solved the puzzle in ${moves} moves!`} cssClasses={["dim-label"]} />
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
                    <GtkLabel
                        label="1. Click any tile adjacent to the empty space to slide it"
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel label="2. Arrange tiles in numerical order (1-15)" halign={Gtk.Align.START} />
                    <GtkLabel
                        label="3. The empty space should end up in the bottom-right corner"
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel label="4. Try to solve it in as few moves as possible!" halign={Gtk.Align.START} />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const slidingPuzzleDemo: Demo = {
    id: "sliding-puzzle",
    title: "Sliding Puzzle",
    description: "The classic 15-puzzle sliding tile game",
    keywords: ["game", "puzzle", "15-puzzle", "sliding", "tiles", "interactive"],
    component: SlidingPuzzleDemo,
    sourceCode,
};
