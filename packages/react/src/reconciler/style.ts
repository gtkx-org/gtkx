import type * as Gtk from "@gtkx/gi/gtk";
import { attachParsingErrorLogger, registerProviderForDefaultDisplay, scopedRule } from "@gtkx/css/internal";
import { STYLE_PROVIDER_PRIORITY_APPLICATION } from "@gtkx/gi/gtk";
import { createLogger, type Logger } from "@gtkx/utils";
import { applyWrite } from "./signals.js";

type StyleSlot = { provider: Gtk.CssProvider; className: string; css: string };

const CLASS_PREFIX = "gtkx-s";
const STYLE_PRIORITY = STYLE_PROVIDER_PRIORITY_APPLICATION + 1;
const log: Logger = createLogger("react");
const styles: WeakMap<Gtk.Widget, StyleSlot> = new WeakMap();
const pool: StyleSlot[] = [];
const counter: { next: number } = { next: 0 };

const reclaimed: FinalizationRegistry<StyleSlot> = new FinalizationRegistry((slot) => {
    pool.push(slot);
});

const createSlot = (): StyleSlot => {
    counter.next += 1;
    const provider = registerProviderForDefaultDisplay({ priority: STYLE_PRIORITY, followsPreferences: false });
    attachParsingErrorLogger(provider, log, "a style prop");

    return { provider, className: `${CLASS_PREFIX}${counter.next.toString()}`, css: "" };
};

const styleClass = (widget: Gtk.Widget): string | null => styles.get(widget)?.className ?? null;

const releaseStyle = (widget: Gtk.Widget): void => {
    const slot = styles.get(widget);

    if (slot === undefined) {
        return;
    }

    styles.delete(widget);
    reclaimed.unregister(widget);

    applyWrite(() => {
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

    applyWrite(() => {
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
        slot.provider.loadFromString(css);
    }

    return slot.className;
};

export { applyStyle, releaseStyle, styleClass };
