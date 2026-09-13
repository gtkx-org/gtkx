import type * as Gtk from "@gtkx/gi/gtk";
import { attachParsingErrorLogger, registerProviderForDefaultDisplay, scopedRule } from "@gtkx/css/internal";
import { STYLE_PROVIDER_PRIORITY_APPLICATION } from "@gtkx/gi/gtk";
import { createLogger, type Logger } from "@gtkx/utils";
import type { Props } from "./registry.js";
import { applyWrite } from "./signals.js";

type StyleState = { ownedClasses: Set<string> };

type StyleSlot = { className: string; css: string };

const CLASS_PREFIX = "gtkx-s";
const CSS_CLASSES_PROP = "cssClasses";
const STYLE_PRIORITY = STYLE_PROVIDER_PRIORITY_APPLICATION + 1;
const log: Logger = createLogger("react");
const styles: WeakMap<Gtk.Widget, StyleSlot> = new WeakMap();
const rules: Map<string, string> = new Map();
const pool: StyleSlot[] = [];
const counter: { next: number } = { next: 0 };
const sheet: { provider: Gtk.CssProvider | null; isDirty: boolean; isFlushScheduled: boolean } = {
    provider: null,
    isDirty: false,
    isFlushScheduled: false,
};

const ensureProvider = (): Gtk.CssProvider => {
    if (sheet.provider !== null) {
        return sheet.provider;
    }

    sheet.provider = registerProviderForDefaultDisplay({ priority: STYLE_PRIORITY, followsPreferences: false });
    attachParsingErrorLogger(sheet.provider, log, "a style prop");

    return sheet.provider;
};

const flushStyles = (): void => {
    if (!sheet.isDirty) {
        return;
    }

    ensureProvider().loadFromString(rules.values().toArray().join("\n"));
    sheet.isDirty = false;
};

const scheduleStylesFlush = (): void => {
    if (sheet.isFlushScheduled) {
        return;
    }

    sheet.isFlushScheduled = true;
    queueMicrotask(() => {
        sheet.isFlushScheduled = false;
        flushStyles();
    });
};

const reclaimed: FinalizationRegistry<StyleSlot> = new FinalizationRegistry((slot) => {
    rules.delete(slot.className);
    slot.css = "";
    pool.push(slot);
    sheet.isDirty = true;
    scheduleStylesFlush();
});

const createSlot = (): StyleSlot => {
    counter.next += 1;

    return { className: `${CLASS_PREFIX}${counter.next.toString()}`, css: "" };
};

const styleClass = (widget: Gtk.Widget): string | null => styles.get(widget)?.className ?? null;

const releaseStyle = (widget: Gtk.Widget): void => {
    const slot = styles.get(widget);

    if (slot === undefined) {
        return;
    }

    styles.delete(widget);
    reclaimed.unregister(widget);
    rules.delete(slot.className);
    slot.css = "";
    sheet.isDirty = true;
    scheduleStylesFlush();

    applyWrite(CSS_CLASSES_PROP, () => {
        widget.removeCssClass(slot.className);
    });

    pool.push(slot);
};

const ensureSlot = (widget: Gtk.Widget): StyleSlot => {
    const existing = styles.get(widget);

    if (existing !== undefined) {
        return existing;
    }

    const slot = pool.pop() ?? createSlot();
    styles.set(widget, slot);
    reclaimed.register(widget, slot, widget);

    applyWrite(CSS_CLASSES_PROP, () => {
        widget.addCssClass(slot.className);
    });

    return slot;
};

const applyStyle = (widget: Gtk.Widget, style: unknown): string | null => {
    if (typeof style !== "object" || style === null) {
        releaseStyle(widget);

        return null;
    }

    const slot = ensureSlot(widget);
    const css = scopedRule(slot.className, style);

    if (css !== slot.css) {
        slot.css = css;
        rules.set(slot.className, css);
        sheet.isDirty = true;
        scheduleStylesFlush();
    }

    return slot.className;
};

const isNullish = (value: unknown): boolean => value === undefined || value === null;

const cssClassNames = (value: unknown): Set<string> =>
    new Set(((value as string[] | null | undefined) ?? []).filter((name) => name !== ""));

const keepOwnedCssClass = (widget: Gtk.Widget, name: string): void => {
    if (!widget.hasCssClass(name)) {
        widget.addCssClass(name);
    }
};

const removeOwnedCssClass = (widget: Gtk.Widget, state: StyleState, name: string, styleName: string | null): void => {
    if (name !== styleName) {
        widget.removeCssClass(name);
    }

    state.ownedClasses.delete(name);
};

const reconcileOwnedCssClasses = (
    widget: Gtk.Widget,
    state: StyleState,
    desired: Set<string>,
    styleName: string | null,
): void => {
    for (const name of state.ownedClasses) {
        if (desired.has(name)) {
            keepOwnedCssClass(widget, name);

            continue;
        }

        removeOwnedCssClass(widget, state, name, styleName);
    }
};

const addDesiredCssClasses = (widget: Gtk.Widget, state: StyleState, desired: Set<string>): void => {
    for (const name of desired) {
        if (widget.hasCssClass(name)) {
            continue;
        }

        widget.addCssClass(name);
        state.ownedClasses.add(name);
    }
};

const applyCssClassDiff = (
    widget: Gtk.Widget,
    state: StyleState,
    desired: Set<string>,
    styleName: string | null,
): void => {
    reconcileOwnedCssClasses(widget, state, desired, styleName);
    addDesiredCssClasses(widget, state, desired);
};

const reconcileCssClasses = (
    widget: Gtk.Widget,
    state: StyleState,
    value: unknown,
    styleName: string | null,
): void => {
    const desired = cssClassNames(value);

    applyWrite(CSS_CLASSES_PROP, () => {
        applyCssClassDiff(widget, state, desired, styleName);
    });
};

function releaseCssClasses(widget: Gtk.Widget, state: StyleState): void {
    const styleName = styleClass(widget);

    applyWrite(CSS_CLASSES_PROP, () => {
        for (const name of state.ownedClasses) {
            if (name === styleName) {
                continue;
            }

            widget.removeCssClass(name);
        }
    });

    state.ownedClasses.clear();
}

const isRestyled = (prev: Props, next: Props): boolean => {
    if (isNullish(prev.style) && isNullish(next.style)) {
        return false;
    }

    return !Object.is(prev.style, next.style);
};

function updateStyle(widget: Gtk.Widget, prev: Props, next: Props, state: StyleState): void {
    const isChanged = isRestyled(prev, next);
    const className = isChanged ? applyStyle(widget, next.style) : styleClass(widget);

    reconcileCssClasses(widget, state, next.cssClasses, className);
}

export { applyStyle, flushStyles, releaseCssClasses, releaseStyle, updateStyle };
