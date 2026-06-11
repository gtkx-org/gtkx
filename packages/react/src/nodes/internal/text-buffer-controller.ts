import type { SignalHandler } from "@gtkx/ffi";
import type * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import type * as GtkSource from "@gtkx/gi/gtksource";
import type { GtkTextViewProps } from "@gtkx/jsx/gtk";
import type { GtkSourceViewProps } from "@gtkx/jsx/gtksource";
import { scheduleFlush } from "../../commit-flush.js";
import { isGtkSourceBuffer, isGtkSourceView, requireClassByName } from "../../gtype-predicates.js";
import type { Instance } from "../../instance.js";
import { hasChanged } from "./props.js";
import { isAnchorWrapper, isBufferContentWrapper, isBufferTextWrapper, isPaintableWrapper } from "./text-wrapper.js";
import { unparentWidget } from "./widget.js";

type BufferCallbackProps = Pick<
    GtkTextViewProps,
    "onBufferChanged" | "onTextInserted" | "onTextDeleted" | "onCanUndoChanged" | "onCanRedoChanged"
>;

type BufferProps = Pick<GtkTextViewProps, "enableUndo" | "buffer"> & BufferCallbackProps;

type SourceBufferProps = Pick<
    GtkSourceViewProps,
    | "language"
    | "styleScheme"
    | "highlightSyntax"
    | "highlightMatchingBrackets"
    | "implicitTrailingNewline"
    | "onCursorMoved"
    | "onHighlightUpdated"
>;

const resolveLanguage = (language: string | GtkSource.Language): GtkSource.Language | null =>
    typeof language === "string"
        ? (requireClassByName("GtkSourceLanguageManager") as typeof GtkSource.LanguageManager)
              .getDefault()
              .getLanguage(language)
        : language;

const resolveStyleScheme = (scheme: string | GtkSource.StyleScheme): GtkSource.StyleScheme | null =>
    typeof scheme === "string"
        ? (requireClassByName("GtkSourceStyleSchemeManager") as typeof GtkSource.StyleSchemeManager)
              .getDefault()
              .getScheme(scheme)
        : scheme;

/**
 * Owns the `Gtk.TextBuffer` of a single `Gtk.TextView` (or `GtkSource.View`),
 * linearizing the view's React content children into buffer text, tag ranges,
 * anchored widgets, and inline paintables.
 *
 * On every structural or content change the buffer is rebuilt in tree order:
 * the children are walked depth-first while the buffer end iterator advances,
 * text runs and inline paintables are inserted, anchored widgets occupy one
 * anchor each, and each `Gtk.TextTag` is applied across the offset range its
 * descendant content spans. The rebuild is bracketed by
 * `beginIrreversibleAction`/`endIrreversibleAction` so it never pollutes the
 * user-facing undo stack, and is coalesced to one pass per commit through a
 * post-commit debounce. Buffer signal handlers are suppressed during a commit
 * by the owner's signal store.
 */
export class TextBufferController {
    private buffer: Gtk.TextBuffer | null = null;
    private externallyManaged = false;
    private managesContent = false;
    private readonly anchoredWidgets = new Set<Gtk.Widget>();
    private readonly boundRebuild = (): void => this.rebuild();

    /**
     * @param owner - The instance whose backing GObject is the text view; its
     *   `children` are the content the buffer is rebuilt from.
     * @param view - The backing `Gtk.TextView` the buffer attaches to.
     */
    constructor(
        private readonly owner: Instance,
        private readonly view: Gtk.TextView,
    ) {}

    /** The view's current buffer, or `null` before one has been created. */
    public getBuffer(): Gtk.TextBuffer | null {
        return this.buffer;
    }

    /** Schedules a single buffer rebuild to run after the current commit drains. */
    public scheduleRebuild(): void {
        scheduleFlush(this.boundRebuild);
    }

    /**
     * Applies the text-view buffer props (`buffer`, `enableUndo`, the buffer
     * signal callbacks) and schedules a content rebuild from the owner's
     * children.
     *
     * @param oldProps - The previously-committed props, or `null` on first mount.
     * @param newProps - The props to apply this commit.
     */
    public applyProps(oldProps: BufferProps | null, newProps: BufferProps): void {
        if (hasChanged(oldProps, newProps, "buffer")) {
            this.setExternalBuffer(newProps.buffer);
        }

        const buffer = this.ensureBuffer();

        if (hasChanged(oldProps, newProps, "enableUndo") && newProps.enableUndo !== undefined) {
            buffer.setEnableUndo(newProps.enableUndo);
        }

        this.applyBufferSignals(oldProps, newProps);
        this.scheduleRebuild();
    }

    /**
     * Applies the props specific to a `GtkSource.View`: syntax language, style
     * scheme, highlight flags, the implicit trailing newline, and the
     * cursor/highlight signal callbacks.
     *
     * @param oldProps - The previously-committed props, or `null` on first mount.
     * @param newProps - The props to apply this commit.
     */
    public applySourceProps(oldProps: SourceBufferProps | null, newProps: SourceBufferProps): void {
        const buffer = this.ensureBuffer();
        if (!isGtkSourceBuffer(buffer)) return;

        this.applySourceBufferProps(buffer, oldProps, newProps);
        this.applySourceSignals(oldProps, newProps);
    }

    /**
     * Releases the controller's buffer signal handlers so the view tears down
     * without leaving handlers connected. The buffer and its anchored widgets
     * are finalized with the view; the controller leaves them untouched.
     */
    public dispose(): void {
        if (this.buffer) this.owner.signalStore.clear(this);
        this.anchoredWidgets.clear();
        this.buffer = null;
        this.externallyManaged = false;
    }

    private ensureBuffer(): Gtk.TextBuffer {
        if (!this.buffer) {
            this.buffer = this.createBuffer();
            this.view.setBuffer(this.buffer);
        }
        return this.buffer;
    }

    private createBuffer(): Gtk.TextBuffer {
        return isGtkSourceView(this.view)
            ? new (requireClassByName("GtkSourceBuffer") as typeof GtkSource.Buffer)()
            : new Gtk.TextBuffer();
    }

    private setExternalBuffer(buffer: Gtk.TextBuffer | null | undefined): void {
        if (buffer) {
            if (this.buffer === buffer && this.externallyManaged) return;
            this.detachBufferSignals();
            this.buffer = buffer;
            this.externallyManaged = true;
            this.view.setBuffer(buffer);
        } else if (this.externallyManaged) {
            this.detachBufferSignals();
            this.buffer = null;
            this.externallyManaged = false;
        }
    }

    private detachBufferSignals(): void {
        if (this.buffer) this.owner.signalStore.clear(this);
    }

    private applyBufferSignals(oldProps: BufferProps | null, newProps: BufferProps): void {
        const changed =
            hasChanged(oldProps, newProps, "onBufferChanged") ||
            hasChanged(oldProps, newProps, "onTextInserted") ||
            hasChanged(oldProps, newProps, "onTextDeleted") ||
            hasChanged(oldProps, newProps, "onCanUndoChanged") ||
            hasChanged(oldProps, newProps, "onCanRedoChanged");
        if (!changed || !this.buffer) return;

        const buffer = this.buffer;
        const { onBufferChanged, onTextInserted, onTextDeleted, onCanUndoChanged, onCanRedoChanged } = newProps;
        this.setBufferSignal("changed", onBufferChanged ? () => onBufferChanged(buffer) : null);
        this.setBufferSignal(
            "insert-text",
            onTextInserted
                ? (...args) => onTextInserted(buffer, (args[0] as Gtk.TextIter).getOffset(), args[1] as string)
                : null,
        );
        this.setBufferSignal(
            "delete-range",
            onTextDeleted
                ? (...args) =>
                      onTextDeleted(
                          buffer,
                          (args[0] as Gtk.TextIter).getOffset(),
                          (args[1] as Gtk.TextIter).getOffset(),
                      )
                : null,
        );
        this.setBufferSignal("notify::can-undo", onCanUndoChanged ? () => onCanUndoChanged(buffer.getCanUndo()) : null);
        this.setBufferSignal("notify::can-redo", onCanRedoChanged ? () => onCanRedoChanged(buffer.getCanRedo()) : null);
    }

    private setBufferSignal(signal: string, handler: SignalHandler | null): void {
        if (!this.buffer) return;
        this.owner.signalStore.set({ owner: this, obj: this.buffer, signal, handler });
    }

    private applySourceBufferProps(
        buffer: GtkSource.Buffer,
        oldProps: SourceBufferProps | null,
        newProps: SourceBufferProps,
    ): void {
        if (hasChanged(oldProps, newProps, "language")) {
            buffer.setLanguage(newProps.language !== undefined ? resolveLanguage(newProps.language) : null);
        }
        if (hasChanged(oldProps, newProps, "styleScheme")) {
            buffer.setStyleScheme(newProps.styleScheme !== undefined ? resolveStyleScheme(newProps.styleScheme) : null);
        }
        if (hasChanged(oldProps, newProps, "highlightSyntax") || hasChanged(oldProps, newProps, "language")) {
            buffer.setHighlightSyntax(newProps.highlightSyntax ?? newProps.language !== undefined);
        }
        if (hasChanged(oldProps, newProps, "highlightMatchingBrackets")) {
            buffer.setHighlightMatchingBrackets(newProps.highlightMatchingBrackets ?? true);
        }
        if (
            hasChanged(oldProps, newProps, "implicitTrailingNewline") &&
            newProps.implicitTrailingNewline !== undefined
        ) {
            buffer.setImplicitTrailingNewline(newProps.implicitTrailingNewline);
        }
    }

    private applySourceSignals(oldProps: SourceBufferProps | null, newProps: SourceBufferProps): void {
        if (hasChanged(oldProps, newProps, "onCursorMoved")) {
            const onCursorMoved = newProps.onCursorMoved;
            this.setBufferSignal("cursor-moved", onCursorMoved ? () => onCursorMoved() : null);
        }
        if (hasChanged(oldProps, newProps, "onHighlightUpdated")) {
            const onHighlightUpdated = newProps.onHighlightUpdated;
            this.setBufferSignal(
                "highlight-updated",
                onHighlightUpdated
                    ? (...args) => onHighlightUpdated(args[0] as Gtk.TextIter, args[1] as Gtk.TextIter)
                    : null,
            );
        }
    }

    private hasManagedChildren(): boolean {
        return this.owner.children.some(
            (child) => isBufferContentWrapper(child) || child.backingInstance instanceof Gtk.TextTag,
        );
    }

    private rebuild(): void {
        const buffer = this.buffer;
        if (!buffer) return;

        if (this.hasManagedChildren()) this.managesContent = true;
        if (!this.managesContent) return;

        this.owner.signalStore.blockAll();
        buffer.beginIrreversibleAction();
        try {
            this.detachAnchoredWidgets();
            this.clearBuffer(buffer);
            this.insertChildren(buffer, this.owner.children);
        } finally {
            buffer.endIrreversibleAction();
            this.owner.signalStore.unblockAll();
        }
    }

    private detachAnchoredWidgets(): void {
        for (const widget of this.anchoredWidgets) unparentWidget(widget);
        this.anchoredWidgets.clear();
    }

    private clearBuffer(buffer: Gtk.TextBuffer): void {
        const start = buffer.getStartIter();
        const end = buffer.getEndIter();
        if (!start.equal(end)) buffer.delete(start, end);

        const tagTable = buffer.getTagTable();
        const tags: Gtk.TextTag[] = [];
        tagTable.foreach((tag) => tags.push(tag));
        for (const tag of tags) tagTable.remove(tag);
    }

    private insertChildren(buffer: Gtk.TextBuffer, children: readonly Instance[]): void {
        for (const child of children) {
            this.insertChild(buffer, child);
        }
    }

    private insertChild(buffer: Gtk.TextBuffer, child: Instance): void {
        const instance = child.backingInstance;
        if (isBufferTextWrapper(child)) {
            this.insertText(buffer, child.props.text as string);
        } else if (isPaintableWrapper(child)) {
            this.insertPaintable(buffer, child.props.paintable as Gdk.Paintable);
        } else if (isAnchorWrapper(child)) {
            this.insertAnchor(buffer, child);
        } else if (instance instanceof Gtk.TextTag) {
            this.insertTag(buffer, child, instance);
        }
    }

    private insertTag(buffer: Gtk.TextBuffer, element: Instance, tag: Gtk.TextTag): void {
        const tagTable = buffer.getTagTable();
        if (tag.name && !tagTable.lookup(tag.name)) tagTable.add(tag);

        const start = buffer.getCharCount();
        this.insertChildren(buffer, element.children);
        const end = buffer.getCharCount();
        if (end > start) {
            buffer.applyTag(tag, buffer.getIterAtOffset(start), buffer.getIterAtOffset(end));
        }
    }

    private insertAnchor(buffer: Gtk.TextBuffer, wrapper: Instance): void {
        const child = wrapper.children[0];
        const widget = child?.backingInstance;
        const replacement = wrapper.props.replacementChar;
        const anchor =
            typeof replacement === "string"
                ? Gtk.TextChildAnchor.newWithReplacement(replacement)
                : Gtk.TextChildAnchor.new();
        buffer.insertChildAnchor(buffer.getEndIter(), anchor);
        if (widget instanceof Gtk.Widget) {
            unparentWidget(widget);
            this.view.addChildAtAnchor(widget, anchor);
            this.anchoredWidgets.add(widget);
        }
    }

    private insertPaintable(buffer: Gtk.TextBuffer, paintable: Gdk.Paintable): void {
        buffer.insertPaintable(buffer.getEndIter(), paintable);
    }

    private insertText(buffer: Gtk.TextBuffer, text: string): void {
        if (text.length === 0) return;
        buffer.insert(buffer.getEndIter(), text, -1);
    }
}
