import { type Context, LineCap, LineJoin } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkDrawingArea, GtkFrame, GtkLabel, GtkScale } from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./path-maze.tsx?raw";

const WALL = 1;
const PATH = 0;
const START = 2;
const END = 3;
const SOLUTION = 4;
const VISITED = 5;

type Cell = typeof WALL | typeof PATH | typeof START | typeof END | typeof SOLUTION | typeof VISITED;

const generateMaze = (width: number, height: number): Cell[][] => {
    const maze: Cell[][] = Array(height)
        .fill(null)
        .map(() => Array(width).fill(WALL));

    const directions: [number, number][] = [
        [0, -2],
        [2, 0],
        [0, 2],
        [-2, 0],
    ];

    const shuffle = <T,>(arr: T[]): T[] => {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = result[i];
            const swapVal = result[j];
            if (temp !== undefined && swapVal !== undefined) {
                result[i] = swapVal;
                result[j] = temp;
            }
        }
        return result;
    };

    const carve = (x: number, y: number) => {
        const row = maze[y];
        if (row) row[x] = PATH;

        for (const [dx, dy] of shuffle(directions)) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && maze[ny]?.[nx] === WALL) {
                const midRow = maze[y + dy / 2];
                if (midRow) midRow[x + dx / 2] = PATH;
                carve(nx, ny);
            }
        }
    };

    carve(1, 1);

    const startRow = maze[1];
    if (startRow) startRow[1] = START;
    const endRow = maze[height - 2];
    if (endRow) endRow[width - 2] = END;

    return maze;
};

const solveMazeBFS = (maze: Cell[][]): { path: [number, number][]; visited: [number, number][] } => {
    const height = maze.length;
    const firstRow = maze[0];
    if (!firstRow) return { path: [], visited: [] };
    const width = firstRow.length;
    const visited: [number, number][] = [];

    let startX = 1,
        startY = 1;
    let endX = width - 2,
        endY = height - 2;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (maze[y]?.[x] === START) {
                startX = x;
                startY = y;
            }
            if (maze[y]?.[x] === END) {
                endX = x;
                endY = y;
            }
        }
    }

    const queue: [number, number, [number, number][]][] = [[startX, startY, [[startX, startY]]]];
    const seen = new Set<string>();
    seen.add(`${startX},${startY}`);

    const directions: [number, number][] = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
    ];

    while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        const [x, y, currentPath] = item;
        visited.push([x, y]);

        if (x === endX && y === endY) {
            return { path: currentPath, visited };
        }

        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            const key = `${nx},${ny}`;

            if (
                nx >= 0 &&
                nx < width &&
                ny >= 0 &&
                ny < height &&
                !seen.has(key) &&
                (maze[ny]?.[nx] === PATH || maze[ny]?.[nx] === END)
            ) {
                seen.add(key);
                queue.push([nx, ny, [...currentPath, [nx, ny]]]);
            }
        }
    }

    return { path: [], visited };
};

const solveMazeAStar = (maze: Cell[][]): { path: [number, number][]; visited: [number, number][] } => {
    const height = maze.length;
    const firstRow = maze[0];
    if (!firstRow) return { path: [], visited: [] };
    const width = firstRow.length;
    const visited: [number, number][] = [];

    let startX = 1,
        startY = 1;
    let endX = width - 2,
        endY = height - 2;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (maze[y]?.[x] === START) {
                startX = x;
                startY = y;
            }
            if (maze[y]?.[x] === END) {
                endX = x;
                endY = y;
            }
        }
    }

    const heuristic = (x: number, y: number) => Math.abs(x - endX) + Math.abs(y - endY);

    const openSet: { x: number; y: number; g: number; f: number; path: [number, number][] }[] = [
        { x: startX, y: startY, g: 0, f: heuristic(startX, startY), path: [[startX, startY]] },
    ];
    const closedSet = new Set<string>();

    const directions: [number, number][] = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
    ];

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        if (!current) break;
        const { x, y, g, path } = current;

        const key = `${x},${y}`;
        if (closedSet.has(key)) continue;
        closedSet.add(key);
        visited.push([x, y]);

        if (x === endX && y === endY) {
            return { path, visited };
        }

        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            const nkey = `${nx},${ny}`;

            if (
                nx >= 0 &&
                nx < width &&
                ny >= 0 &&
                ny < height &&
                !closedSet.has(nkey) &&
                (maze[ny]?.[nx] === PATH || maze[ny]?.[nx] === END)
            ) {
                const newG = g + 1;
                openSet.push({
                    x: nx,
                    y: ny,
                    g: newG,
                    f: newG + heuristic(nx, ny),
                    path: [...path, [nx, ny]],
                });
            }
        }
    }

    return { path: [], visited };
};

const MazeDemo = () => {
    const ref = useRef<Gtk.DrawingArea | null>(null);
    const [mazeSize, setMazeSize] = useState(21);
    const [maze, setMaze] = useState<Cell[][]>(() => generateMaze(21, 21));
    const [solution, setSolution] = useState<{ path: [number, number][]; visited: [number, number][] }>({
        path: [],
        visited: [],
    });
    const [animationStep, setAnimationStep] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [algorithm, setAlgorithm] = useState<"bfs" | "astar">("bfs");
    const sizeAdjustment = useMemo(() => new Gtk.Adjustment(21, 11, 41, 2, 4, 0), []);

    const drawMaze = useCallback(
        (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            const mazeWidth = maze[0]?.length ?? 1;
            const cellWidth = width / mazeWidth;
            const cellHeight = height / maze.length;

            for (let y = 0; y < maze.length; y++) {
                for (let x = 0; x < mazeWidth; x++) {
                    const cell = maze[y]?.[x];
                    const px = x * cellWidth;
                    const py = y * cellHeight;

                    switch (cell) {
                        case WALL:
                            cr.setSourceRgb(0.2, 0.2, 0.25);
                            break;
                        case PATH:
                            cr.setSourceRgb(0.95, 0.95, 0.9);
                            break;
                        case START:
                            cr.setSourceRgb(0.2, 0.7, 0.3);
                            break;
                        case END:
                            cr.setSourceRgb(0.8, 0.2, 0.3);
                            break;
                        default:
                            cr.setSourceRgb(0.95, 0.95, 0.9);
                    }
                    cr.rectangle(px, py, cellWidth, cellHeight).fill();
                }
            }

            if (animationStep > 0 && solution.visited.length > 0) {
                const visitedCount = Math.min(animationStep, solution.visited.length);
                cr.setSourceRgba(0.6, 0.8, 1, 0.5);

                for (let i = 0; i < visitedCount; i++) {
                    const visitedCell = solution.visited[i];
                    if (visitedCell) {
                        const [x, y] = visitedCell;
                        if (maze[y]?.[x] !== START && maze[y]?.[x] !== END) {
                            cr.rectangle(x * cellWidth + 1, y * cellHeight + 1, cellWidth - 2, cellHeight - 2).fill();
                        }
                    }
                }
            }

            if (solution.path.length > 1 && animationStep >= solution.visited.length) {
                const pathProgress = animationStep - solution.visited.length;
                const pathCount = Math.min(pathProgress, solution.path.length);

                if (pathCount > 1) {
                    cr.setSourceRgb(0.9, 0.6, 0.1)
                        .setLineWidth(Math.min(cellWidth, cellHeight) * 0.4)
                        .setLineCap(LineCap.ROUND)
                        .setLineJoin(LineJoin.ROUND);

                    const firstCell = solution.path[0];
                    if (firstCell) {
                        const [firstX, firstY] = firstCell;
                        cr.moveTo((firstX + 0.5) * cellWidth, (firstY + 0.5) * cellHeight);

                        for (let i = 1; i < pathCount; i++) {
                            const pathCell = solution.path[i];
                            if (pathCell) {
                                const [x, y] = pathCell;
                                cr.lineTo((x + 0.5) * cellWidth, (y + 0.5) * cellHeight);
                            }
                        }
                        cr.stroke();
                    }
                }
            }

            cr.setSourceRgba(0, 0, 0, 0.1).setLineWidth(0.5);
            for (let x = 0; x <= mazeWidth; x++) {
                cr.moveTo(x * cellWidth, 0).lineTo(x * cellWidth, height);
            }
            for (let y = 0; y <= maze.length; y++) {
                cr.moveTo(0, y * cellHeight).lineTo(width, y * cellHeight);
            }
            cr.stroke();
        },
        [maze, solution, animationStep],
    );

    useEffect(() => {
        if (ref.current) {
            ref.current.setDrawFunc(drawMaze);
        }
    }, [drawMaze]);

    useEffect(() => {
        if (!isAnimating) return;

        const totalSteps = solution.visited.length + solution.path.length;
        if (animationStep >= totalSteps) {
            setIsAnimating(false);
            return;
        }

        const timer = setTimeout(() => {
            setAnimationStep((s) => s + 1);
            if (ref.current) {
                ref.current.queueDraw();
            }
        }, 30);

        return () => clearTimeout(timer);
    }, [isAnimating, animationStep, solution]);

    const handleGenerate = () => {
        const size = mazeSize % 2 === 0 ? mazeSize + 1 : mazeSize;
        const newMaze = generateMaze(size, size);
        setMaze(newMaze);
        setSolution({ path: [], visited: [] });
        setAnimationStep(0);
        setIsAnimating(false);
    };

    const handleSolve = () => {
        const result = algorithm === "bfs" ? solveMazeBFS(maze) : solveMazeAStar(maze);
        setSolution(result);
        setAnimationStep(0);
        setIsAnimating(true);
    };

    const handleReset = () => {
        setSolution({ path: [], visited: [] });
        setAnimationStep(0);
        setIsAnimating(false);
        if (ref.current) {
            ref.current.queueDraw();
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Maze Generation & Path Finding" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Generate random mazes and visualize pathfinding algorithms. Watch BFS or A* explore the maze and find the solution."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Maze">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkDrawingArea
                        ref={ref}
                        contentWidth={400}
                        contentHeight={400}
                        cssClasses={["card"]}
                        halign={Gtk.Align.CENTER}
                    />

                    <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkLabel label="Size:" cssClasses={["dim-label"]} />
                        <GtkScale
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            adjustment={sizeAdjustment}
                            onValueChanged={(range: Gtk.Range) => {
                                const val = Math.round(range.getValue());
                                setMazeSize(val % 2 === 0 ? val + 1 : val);
                            }}
                            widthRequest={150}
                        />
                    </GtkBox>

                    <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkLabel label="Algorithm:" cssClasses={["dim-label"]} />
                        <GtkButton
                            label="BFS"
                            onClicked={() => setAlgorithm("bfs")}
                            cssClasses={algorithm === "bfs" ? ["suggested-action"] : ["flat"]}
                        />
                        <GtkButton
                            label="A*"
                            onClicked={() => setAlgorithm("astar")}
                            cssClasses={algorithm === "astar" ? ["suggested-action"] : ["flat"]}
                        />
                    </GtkBox>

                    <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkButton label="Generate" onClicked={handleGenerate} cssClasses={["flat"]} />
                        <GtkButton
                            label="Solve"
                            onClicked={handleSolve}
                            cssClasses={["suggested-action"]}
                            sensitive={!isAnimating}
                        />
                        <GtkButton label="Reset" onClicked={handleReset} cssClasses={["flat"]} />
                    </GtkBox>

                    {solution.path.length > 0 && !isAnimating && (
                        <GtkLabel
                            label={`Solution found! Path length: ${solution.path.length}, Cells explored: ${solution.visited.length}`}
                            cssClasses={["dim-label"]}
                            halign={Gtk.Align.CENTER}
                        />
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Legend">
                <GtkBox
                    spacing={24}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkBox spacing={4}>
                        <GtkLabel label="Start" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox spacing={4}>
                        <GtkLabel label="End" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox spacing={4}>
                        <GtkLabel label="Explored" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox spacing={4}>
                        <GtkLabel label="Solution" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const pathMazeDemo: Demo = {
    id: "path-maze",
    title: "Path/Maze",
    description: "Maze generation and pathfinding visualization",
    keywords: ["maze", "pathfinding", "bfs", "astar", "algorithm", "generation", "animation", "recursive"],
    component: MazeDemo,
    sourceCode,
};
