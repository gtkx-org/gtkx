import { css } from "@gtkx/css";
import * as Gdk from "@gtkx/ffi/gdk";
import * as GLib from "@gtkx/ffi/glib";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkGrid, GtkHeaderBar, GtkImage, x } from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import { SYSTEM_SOUNDS, useSound } from "../../hooks/index.js";
import type { Demo } from "../types.js";
import sourceCode from "./peg-solitaire.tsx?raw";

const PEG_SIZE = 32;
const GRID_SPACING = 6;
const BOARD_SIZE = 7;

const INITIAL_BOARD: number[][] = [
    [-1, -1, 1, 1, 1, -1, -1],
    [-1, -1, 1, 1, 1, -1, -1],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 0, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [-1, -1, 1, 1, 1, -1, -1],
    [-1, -1, 1, 1, 1, -1, -1],
];

type Position = { row: number; col: number };
type Board = number[][];

const fieldStyle = css`
    .solitaire-field {
        border: 1px solid lightgray;
    }
`;

const copyBoard = (board: Board): Board => board.map((row) => [...row]);

const countPegs = (board: Board): number => {
    let count = 0;
    for (const row of board) {
        for (const cell of row) {
            if (cell === 1) count++;
        }
    }
    return count;
};

const isValidJump = (board: Board, from: Position, to: Position): Position | null => {
    const rowDiff = to.row - from.row;
    const colDiff = to.col - from.col;

    if (!((Math.abs(rowDiff) === 2 && colDiff === 0) || (Math.abs(colDiff) === 2 && rowDiff === 0))) {
        return null;
    }

    if (to.row < 0 || to.row >= BOARD_SIZE || to.col < 0 || to.col >= BOARD_SIZE) {
        return null;
    }

    if (board[to.row]?.[to.col] !== 0) {
        return null;
    }

    const midRow = from.row + rowDiff / 2;
    const midCol = from.col + colDiff / 2;

    if (board[midRow]?.[midCol] !== 1) {
        return null;
    }

    return { row: midRow, col: midCol };
};

const getValidMoves = (board: Board, from: Position): Position[] => {
    const moves: Position[] = [];
    const directions = [
        { row: -2, col: 0 },
        { row: 2, col: 0 },
        { row: 0, col: -2 },
        { row: 0, col: 2 },
    ];

    for (const dir of directions) {
        const to = { row: from.row + dir.row, col: from.col + dir.col };
        if (isValidJump(board, from, to)) {
            moves.push(to);
        }
    }

    return moves;
};

const hasValidMoves = (board: Board): boolean => {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row]?.[col] === 1) {
                if (getValidMoves(board, { row, col }).length > 0) {
                    return true;
                }
            }
        }
    }
    return false;
};

let pegTextureCache: Gdk.Texture | null = null;

const getPegTexture = (): Gdk.Texture => {
    if (pegTextureCache) return pegTextureCache;

    const r = Math.round(0.6 * 255);
    const g = Math.round(0.3 * 255);
    const b = Math.round(0.0 * 255);

    const data: number[] = [];
    for (let i = 0; i < PEG_SIZE * PEG_SIZE; i++) {
        data.push(r, g, b, 255);
    }

    const bytes = new GLib.Bytes(data.length, data);
    const builder = new Gdk.MemoryTextureBuilder();
    builder.setWidth(PEG_SIZE);
    builder.setHeight(PEG_SIZE);
    builder.setFormat(Gdk.MemoryFormat.R8G8B8A8);
    builder.setBytes(bytes);
    builder.setStride(PEG_SIZE * 4);

    pegTextureCache = builder.build();
    return pegTextureCache;
};

const PegSolitaireDemo = () => {
    const [board, setBoard] = useState<Board>(() => copyBoard(INITIAL_BOARD));
    const [draggingFrom, setDraggingFrom] = useState<Position | null>(null);
    const gameEndedRef = useRef(false);

    const victorySound = useSound(SYSTEM_SOUNDS.complete, { volume: 1.0 });
    const gameOverSound = useSound(SYSTEM_SOUNDS.warning, { volume: 1.0 });

    const celebrate = useCallback(
        (win: boolean) => {
            if (win) victorySound.play();
            else gameOverSound.play();
        },
        [victorySound, gameOverSound],
    );

    const handleDrop = useCallback(
        (value: GObject.Value, toRow: number, toCol: number): boolean => {
            const coords = value.getString();
            if (!coords) return false;

            const [fromRowStr, fromColStr] = coords.split(",");
            const fromRow = Number(fromRowStr);
            const fromCol = Number(fromColStr);
            const from = { row: fromRow, col: fromCol };
            const to = { row: toRow, col: toCol };

            const jumped = isValidJump(board, from, to);
            if (!jumped) return false;

            const newBoard = copyBoard(board);
            const fromRowArr = newBoard[from.row];
            const jumpedRowArr = newBoard[jumped.row];
            const toRowArr = newBoard[to.row];
            if (fromRowArr) fromRowArr[from.col] = 0;
            if (jumpedRowArr) jumpedRowArr[jumped.col] = 0;
            if (toRowArr) toRowArr[to.col] = 1;

            setBoard(newBoard);
            setDraggingFrom(null);

            if (!hasValidMoves(newBoard)) {
                const pegCount = countPegs(newBoard);
                const isWin = pegCount === 1 && newBoard[3]?.[3] === 1;
                gameEndedRef.current = true;
                celebrate(isWin);
            }

            return true;
        },
        [board, celebrate],
    );

    const handleNewGame = useCallback(() => {
        setBoard(copyBoard(INITIAL_BOARD));
        setDraggingFrom(null);
        gameEndedRef.current = false;
    }, []);

    const pegTexture = getPegTexture();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={[fieldStyle]}>
            <GtkHeaderBar>
                <x.PackStart>
                    <GtkButton iconName="view-refresh-symbolic" onClicked={handleNewGame} />
                </x.PackStart>
            </GtkHeaderBar>

            <GtkGrid
                rowSpacing={GRID_SPACING}
                columnSpacing={GRID_SPACING}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                rowHomogeneous
                columnHomogeneous
                vexpand
                hexpand
            >
                {board.map((row, rowIndex) =>
                    row.map((cell, colIndex) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Grid cells have stable positions
                        <x.GridChild key={`cell-${rowIndex}-${colIndex}`} column={colIndex} row={rowIndex}>
                            {cell === -1 ? (
                                <GtkBox widthRequest={PEG_SIZE} heightRequest={PEG_SIZE} />
                            ) : cell === 1 ? (
                                <GtkImage
                                    paintable={
                                        draggingFrom?.row === rowIndex && draggingFrom?.col === colIndex
                                            ? null
                                            : pegTexture
                                    }
                                    cssClasses={["solitaire-field"]}
                                    widthRequest={PEG_SIZE}
                                    heightRequest={PEG_SIZE}
                                    iconSize={Gtk.IconSize.LARGE}
                                    onDragPrepare={() =>
                                        Gdk.ContentProvider.newForValue(
                                            GObject.Value.newFromString(`${rowIndex},${colIndex}`),
                                        )
                                    }
                                    onDragBegin={() => setDraggingFrom({ row: rowIndex, col: colIndex })}
                                    onDragEnd={(_drag, deleteData) => {
                                        if (!deleteData) setDraggingFrom(null);
                                    }}
                                    dragActions={Gdk.DragAction.MOVE}
                                    dragIcon={pegTexture}
                                    dragIconHotX={-2}
                                    dragIconHotY={-2}
                                />
                            ) : (
                                <GtkImage
                                    cssClasses={["solitaire-field"]}
                                    widthRequest={PEG_SIZE}
                                    heightRequest={PEG_SIZE}
                                    iconSize={Gtk.IconSize.LARGE}
                                    dropTypes={[GObject.Type.STRING]}
                                    onDropMotion={() => Gdk.DragAction.MOVE}
                                    onDrop={(value: GObject.Value) => handleDrop(value, rowIndex, colIndex)}
                                />
                            )}
                        </x.GridChild>
                    )),
                )}
            </GtkGrid>
        </GtkBox>
    );
};

export const pegSolitaireDemo: Demo = {
    id: "peg-solitaire",
    title: "Peg Solitaire",
    description: "Classic peg solitaire board game with drag-and-drop",
    keywords: ["game", "puzzle", "solitaire", "peg", "board game", "interactive", "drag", "drop"],
    component: PegSolitaireDemo,
    sourceCode,
};
