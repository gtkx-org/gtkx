import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";
import { useCallback, useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const GRID_SIZE = 4;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;

type TileBoard = (number | null)[];

const createSolvedBoard = (): TileBoard => {
    const board: TileBoard = [];
    for (let i = 1; i < TOTAL_TILES; i++) {
        board.push(i);
    }
    board.push(null);
    return board;
};

const shuffleBoard = (board: TileBoard): TileBoard => {
    const shuffled = [...board];
    for (let i = 0; i < 1000; i++) {
        const emptyIndex = shuffled.indexOf(null);
        const moves = getValidMoves(emptyIndex);
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        if (randomMove !== undefined) {
            const value = shuffled[randomMove];
            shuffled[emptyIndex] = value !== undefined ? value : null;
            shuffled[randomMove] = null;
        }
    }
    return shuffled;
};

const getValidMoves = (emptyIndex: number): number[] => {
    const moves: number[] = [];
    const row = Math.floor(emptyIndex / GRID_SIZE);
    const col = emptyIndex % GRID_SIZE;

    if (row > 0) moves.push(emptyIndex - GRID_SIZE);
    if (row < GRID_SIZE - 1) moves.push(emptyIndex + GRID_SIZE);
    if (col > 0) moves.push(emptyIndex - 1);
    if (col < GRID_SIZE - 1) moves.push(emptyIndex + 1);

    return moves;
};

const isSolved = (board: TileBoard): boolean => {
    for (let i = 0; i < TOTAL_TILES - 1; i++) {
        if (board[i] !== i + 1) return false;
    }
    return board[TOTAL_TILES - 1] === null;
};

const tileStyle = css`
    min-width: 60px;
    min-height: 60px;
    font-size: 18px;
    font-weight: bold;
`;

const emptyTileStyle = css`
    min-width: 60px;
    min-height: 60px;
    opacity: 0.3;
`;

const TileButton = ({
    tile,
    canMove,
    solved,
    onClick,
}: {
    tile: number | null;
    canMove: boolean;
    solved: boolean;
    onClick: () => void;
}) => {
    if (tile === null) {
        return <Button label="" cssClasses={[emptyTileStyle]} sensitive={false} />;
    }

    return (
        <Button
            label={String(tile)}
            cssClasses={[tileStyle, canMove ? "suggested-action" : ""]}
            onClicked={onClick}
            sensitive={canMove && !solved}
        />
    );
};

const FifteenPuzzleDemo = () => {
    const [board, setBoard] = useState<TileBoard>(() => shuffleBoard(createSolvedBoard()));
    const [moves, setMoves] = useState(0);
    const [solved, setSolved] = useState(false);

    const handleTileClick = useCallback(
        (index: number) => {
            if (solved) return;

            const emptyIndex = board.indexOf(null);
            const validMoves = getValidMoves(emptyIndex);

            if (validMoves.includes(index)) {
                const newBoard = [...board];
                const value = newBoard[index];
                newBoard[emptyIndex] = value !== undefined ? value : null;
                newBoard[index] = null;
                setBoard(newBoard);
                setMoves((m) => m + 1);

                if (isSolved(newBoard)) {
                    setSolved(true);
                }
            }
        },
        [board, solved],
    );

    const handleNewGame = useCallback(() => {
        setBoard(shuffleBoard(createSolvedBoard()));
        setMoves(0);
        setSolved(false);
    }, []);

    const getRow = (rowIndex: number) => {
        const startIdx = rowIndex * GRID_SIZE;
        return board.slice(startIdx, startIdx + GRID_SIZE);
    };

    const emptyIndex = board.indexOf(null);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="15 Puzzle" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root
                    label="Slide the tiles to arrange them in numerical order. Click a tile adjacent to the empty space to move it."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                <Label.Root label={`Moves: ${moves}`} cssClasses={["heading"]} />
                {solved && <Label.Root label="Solved!" cssClasses={["success"]} />}
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.CENTER} spacing={4}>
                {[0, 1, 2, 3].map((rowIdx) => (
                    <Box key={rowIdx} orientation={Gtk.Orientation.HORIZONTAL} spacing={4} homogeneous>
                        {getRow(rowIdx).map((tile, colIdx) => {
                            const index = rowIdx * GRID_SIZE + colIdx;
                            const canMove = getValidMoves(emptyIndex).includes(index);
                            return (
                                <TileButton
                                    key={index}
                                    tile={tile}
                                    canMove={canMove}
                                    solved={solved}
                                    onClick={() => handleTileClick(index)}
                                />
                            );
                        })}
                    </Box>
                ))}
            </Box>

            <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12} halign={Gtk.Align.CENTER}>
                <Button label="New Game" cssClasses={["destructive-action"]} onClicked={handleNewGame} />
            </Box>
        </Box>
    );
};

export const fifteenPuzzleDemo: Demo = {
    id: "fifteen-puzzle",
    title: "15 Puzzle",
    description: "Classic sliding tile puzzle game.",
    keywords: ["game", "puzzle", "15", "sliding", "tiles", "interactive"],
    component: FifteenPuzzleDemo,
    sourcePath: getSourcePath(import.meta.url, "fifteen-puzzle.tsx"),
};
