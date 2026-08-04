import type { NodeRef } from "./collection-index.js";

type SpliceStep = {
    nodes: NodeRef[];
    start: number;
    removed: number;
    added: number;
};

type SplicePlan = {
    steps: SpliceStep[];
    rebuilt: NodeRef[];
};

type ChangedWindow = {
    start: number;
    previous: NodeRef[];
    next: NodeRef[];
};

type MoveBlock = {
    block: NodeRef[];
    from: number;
    to: number;
};

const NO_MOVE = -1;

function commonPrefix(previous: NodeRef[], next: NodeRef[], max: number): number {
    let count = 0;

    while (count < max && previous[count]?.key === next[count]?.key) {
        count += 1;
    }

    return count;
}

function commonSuffix(previous: NodeRef[], next: NodeRef[], max: number): number {
    let count = 0;

    while (count < max && previous[previous.length - 1 - count]?.key === next[next.length - 1 - count]?.key) {
        count += 1;
    }

    return count;
}

function changedWindow(previous: NodeRef[], next: NodeRef[]): ChangedWindow | null {
    const shared = Math.min(previous.length, next.length);
    const start = commonPrefix(previous, next, shared);

    if (start === previous.length && start === next.length) {
        return null;
    }

    const tail = commonSuffix(previous, next, shared - start);

    return {
        start,
        previous: previous.slice(start, previous.length - tail),
        next: next.slice(start, next.length - tail),
    };
}

function isRotationBy(window: ChangedWindow, offset: number): boolean {
    const size = window.previous.length;

    return window.next.every((node, index) => node.key === window.previous[(index + offset) % size]?.key);
}

function rotationOffset(window: ChangedWindow): number {
    const [first] = window.next;

    if (first === undefined || window.previous.length !== window.next.length) {
        return NO_MOVE;
    }

    const offset = window.previous.findIndex((node) => node.key === first.key);

    return offset > 0 && isRotationBy(window, offset) ? offset : NO_MOVE;
}

function getExpansionCost(block: NodeRef[], expanded: Set<string>): number {
    return block.filter((node) => expanded.has(node.key)).length;
}

function isLeadingBlockCheaper(leading: MoveBlock, trailing: MoveBlock, expanded: Set<string>): boolean {
    const cost = getExpansionCost(leading.block, expanded);
    const rival = getExpansionCost(trailing.block, expanded);

    if (cost !== rival) {
        return cost < rival;
    }

    return leading.block.length <= trailing.block.length;
}

function moveFor(window: ChangedWindow, offset: number, expanded: Set<string>): MoveBlock {
    const tail = window.previous.length - offset;

    const leading: MoveBlock = {
        block: window.previous.slice(0, offset),
        from: window.start,
        to: window.start + tail,
    };

    const trailing: MoveBlock = {
        block: window.previous.slice(offset),
        from: window.start + offset,
        to: window.start,
    };

    return isLeadingBlockCheaper(leading, trailing, expanded) ? leading : trailing;
}

function moveSteps(previous: NodeRef[], next: NodeRef[], move: MoveBlock): SpliceStep[] {
    const size = move.block.length;
    const lifted = [...previous.slice(0, move.from), ...previous.slice(move.from + size)];

    return [
        { nodes: lifted, start: move.from, removed: size, added: 0 },
        { nodes: next, start: move.to, removed: 0, added: size },
    ];
}

function replaceStep(next: NodeRef[], window: ChangedWindow): SpliceStep {
    return { nodes: next, start: window.start, removed: window.previous.length, added: window.next.length };
}

function splicePlan(previous: NodeRef[], next: NodeRef[], expanded: Set<string>): SplicePlan | null {
    const window = changedWindow(previous, next);

    if (window === null) {
        return null;
    }

    const offset = rotationOffset(window);

    if (offset === NO_MOVE) {
        return { steps: [replaceStep(next, window)], rebuilt: [...window.previous, ...window.next] };
    }

    const move = moveFor(window, offset, expanded);

    return { steps: moveSteps(previous, next, move), rebuilt: move.block };
}

export { splicePlan, type SplicePlan, type SpliceStep };
