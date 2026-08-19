import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";

type FrameCallback = () => void;
type Timer = ReturnType<typeof setTimeout>;
type Driver = { widget: Gtk.Widget; tickId: number; stallSource: number };

type Scheduler = {
    callbacks: FrameCallback[];
    driver: Driver | null;
    fallbackTimer: Timer | null;
    flushedAt: number;
    isTicking: boolean;
    stalledUntil: WeakMap<Gtk.Widget, number>;
    ticks: number;
};

const FALLBACK_FRAME_MS = 16;
const MIN_FRAME_MS = 1;
const STALL_MS = 250;
const STALL_COOLDOWN_MS = 1000;

const scheduler: Scheduler = {
    callbacks: [],
    driver: null,
    fallbackTimer: null,
    flushedAt: 0,
    isTicking: false,
    stalledUntil: new WeakMap(),
    ticks: 0,
};

const isSuspended = (widget: Gtk.Widget): boolean => widget instanceof Gtk.Window && widget.isSuspended();

const hasClock = (widget: Gtk.Widget): boolean =>
    widget.getMapped() && widget.getFrameClock() !== null && !isSuspended(widget);

const isCoolingDown = (widget: Gtk.Widget): boolean => {
    const until = scheduler.stalledUntil.get(widget);

    if (until === undefined) {
        return false;
    }

    if (performance.now() < until) {
        return true;
    }

    scheduler.stalledUntil.delete(widget);

    return false;
};

const findDriverWidget = (): Gtk.Widget | null => {
    const candidates = Gtk.Window.listToplevels().filter((widget) => hasClock(widget));

    return candidates.find((widget) => !scheduler.stalledUntil.has(widget)) ??
        candidates.find((widget) => !isCoolingDown(widget)) ??
        null;
};

const flush = (): void => {
    const pending = scheduler.callbacks;
    scheduler.callbacks = [];
    scheduler.isTicking = true;
    scheduler.flushedAt = performance.now();

    try {
        for (const callback of pending) {
            callback();
        }
    } finally {
        scheduler.isTicking = false;
    }
};

const armStallSource = (): number => GLib.timeoutAdd(GLib.PRIORITY_DEFAULT_IDLE, STALL_MS, shouldRepeatStallCheck);

const cancelStallSource = (driver: Driver): void => {
    if (driver.stallSource === 0) {
        return;
    }

    GLib.Source.remove(driver.stallSource);
    driver.stallSource = 0;
};

const finishDriver = (driver: Driver): void => {
    cancelStallSource(driver);
    driver.widget.off("unmap", onDriverUnmapped);
    scheduler.driver = null;
};

const releaseDriver = (driver: Driver): void => {
    finishDriver(driver);
    driver.widget.removeTickCallback(driver.tickId);
};

const flushThenArm = (): void => {
    try {
        flush();
    } finally {
        arm();
    }
};

const shouldContinueTicking = (driver: Driver): boolean => {
    if (scheduler.driver !== driver) {
        arm();

        return GLib.SOURCE_REMOVE;
    }

    if (scheduler.callbacks.length === 0) {
        finishDriver(driver);

        return GLib.SOURCE_REMOVE;
    }

    driver.stallSource = armStallSource();

    return GLib.SOURCE_CONTINUE;
};

const shouldKeepTicking = (): boolean => {
    const { driver } = scheduler;

    if (driver === null) {
        return GLib.SOURCE_REMOVE;
    }

    if (performance.now() - scheduler.flushedAt < MIN_FRAME_MS) {
        return GLib.SOURCE_CONTINUE;
    }

    cancelStallSource(driver);
    scheduler.ticks += 1;
    scheduler.stalledUntil.delete(driver.widget);

    try {
        flush();
    } catch (error) {
        finishDriver(driver);
        arm();
        throw error;
    }

    return shouldContinueTicking(driver);
};

const onFallbackFrame = (): void => {
    scheduler.fallbackTimer = null;
    flushThenArm();
};

const armDriver = (widget: Gtk.Widget): void => {
    const tickId = widget.addTickCallback(shouldKeepTicking);
    scheduler.driver = { widget, tickId, stallSource: armStallSource() };
    widget.on("unmap", onDriverUnmapped);
};

function shouldRepeatStallCheck(): boolean {
    const { driver } = scheduler;

    if (driver !== null) {
        driver.stallSource = 0;
        releaseDriver(driver);
        scheduler.stalledUntil.set(driver.widget, performance.now() + STALL_COOLDOWN_MS);
        flushThenArm();
    }

    return GLib.SOURCE_REMOVE;
}

function onDriverUnmapped(): void {
    const { driver } = scheduler;

    if (driver === null) {
        return;
    }

    scheduler.stalledUntil.delete(driver.widget);
    releaseDriver(driver);

    if (!scheduler.isTicking) {
        arm();
    }
}

function arm(): void {
    if (scheduler.callbacks.length === 0 || scheduler.driver !== null || scheduler.fallbackTimer !== null) {
        return;
    }

    const widget = findDriverWidget();

    if (widget === null) {
        scheduler.fallbackTimer = setTimeout(onFallbackFrame, FALLBACK_FRAME_MS);

        return;
    }

    armDriver(widget);
}

const requestFrame = (callback: FrameCallback): void => {
    scheduler.callbacks.push(callback);

    if (!scheduler.isTicking) {
        arm();
    }
};

export { requestFrame };
