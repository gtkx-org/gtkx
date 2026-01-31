import type * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import type { Props } from "../types.js";
import { TextBufferController } from "./internal/text-buffer-controller.js";
import { hasChanged } from "./internal/utils.js";
import { TextViewNode } from "./text-view.js";

type SourceViewProps = Props & {
    enableUndo?: boolean;
    onBufferChanged?: ((buffer: Gtk.TextBuffer) => void) | null;
    onTextInserted?: ((buffer: Gtk.TextBuffer, offset: number, text: string) => void) | null;
    onTextDeleted?: ((buffer: Gtk.TextBuffer, startOffset: number, endOffset: number) => void) | null;
    onCanUndoChanged?: ((canUndo: boolean) => void) | null;
    onCanRedoChanged?: ((canRedo: boolean) => void) | null;
    language?: string | GtkSource.Language;
    styleScheme?: string | GtkSource.StyleScheme;
    highlightSyntax?: boolean;
    highlightMatchingBrackets?: boolean;
    implicitTrailingNewline?: boolean;
    onCursorMoved?: (() => void) | null;
    onHighlightUpdated?: ((start: Gtk.TextIter, end: Gtk.TextIter) => void) | null;
};

export class SourceViewNode extends TextViewNode {
    protected override createBufferController(): TextBufferController<GtkSource.Buffer> {
        return new TextBufferController<GtkSource.Buffer>(this, this.container, () => new GtkSource.Buffer());
    }

    protected override ensureBufferController(): TextBufferController<GtkSource.Buffer> {
        return super.ensureBufferController() as TextBufferController<GtkSource.Buffer>;
    }

    protected override applyOwnProps(oldProps: SourceViewProps | null, newProps: SourceViewProps): void {
        super.applyOwnProps(oldProps, newProps);
        this.applySourceViewProps(oldProps, newProps);
    }

    private resolveLanguage(language: string | GtkSource.Language): GtkSource.Language | null {
        if (typeof language === "string") {
            const langManager = GtkSource.LanguageManager.getDefault();
            return langManager.getLanguage(language);
        }
        return language;
    }

    private resolveStyleScheme(scheme: string | GtkSource.StyleScheme): GtkSource.StyleScheme | null {
        if (typeof scheme === "string") {
            const schemeManager = GtkSource.StyleSchemeManager.getDefault();
            return schemeManager.getScheme(scheme);
        }
        return scheme;
    }

    private applySourceViewProps(oldProps: SourceViewProps | null, newProps: SourceViewProps): void {
        const hasSourceViewProps =
            newProps.language !== undefined ||
            newProps.styleScheme !== undefined ||
            newProps.highlightSyntax !== undefined ||
            newProps.highlightMatchingBrackets !== undefined ||
            newProps.implicitTrailingNewline !== undefined ||
            newProps.onCursorMoved !== undefined ||
            newProps.onHighlightUpdated !== undefined ||
            oldProps?.language !== undefined ||
            oldProps?.styleScheme !== undefined;

        if (!hasSourceViewProps) {
            return;
        }

        const buffer = this.ensureBufferController().ensureBuffer();

        if (hasChanged(oldProps, newProps, "language")) {
            if (newProps.language !== undefined) {
                const language = this.resolveLanguage(newProps.language);
                buffer.setLanguage(language);
            } else if (oldProps?.language !== undefined) {
                buffer.setLanguage(null);
            }
        }

        if (hasChanged(oldProps, newProps, "styleScheme")) {
            if (newProps.styleScheme !== undefined) {
                const scheme = this.resolveStyleScheme(newProps.styleScheme);
                buffer.setStyleScheme(scheme);
            } else if (oldProps?.styleScheme !== undefined) {
                buffer.setStyleScheme(null);
            }
        }

        if (hasChanged(oldProps, newProps, "highlightSyntax") || hasChanged(oldProps, newProps, "language")) {
            const highlightSyntax = newProps.highlightSyntax ?? newProps.language !== undefined;
            buffer.setHighlightSyntax(highlightSyntax);
        }

        if (hasChanged(oldProps, newProps, "highlightMatchingBrackets")) {
            const highlightMatchingBrackets = newProps.highlightMatchingBrackets ?? true;
            buffer.setHighlightMatchingBrackets(highlightMatchingBrackets);
        }

        if (hasChanged(oldProps, newProps, "implicitTrailingNewline")) {
            if (newProps.implicitTrailingNewline !== undefined) {
                buffer.setImplicitTrailingNewline(newProps.implicitTrailingNewline);
            }
        }

        if (hasChanged(oldProps, newProps, "onCursorMoved") || hasChanged(oldProps, newProps, "onHighlightUpdated")) {
            this.updateSourceViewSignalHandlers(newProps);
        }
    }

    private updateSourceViewSignalHandlers(props: SourceViewProps): void {
        const buffer = this.ensureBufferController().getBuffer();
        if (!buffer) return;

        const { onCursorMoved, onHighlightUpdated } = props;

        this.signalStore.set(this, buffer, "cursor-moved", onCursorMoved ?? null);

        this.signalStore.set(
            this,
            buffer,
            "highlight-updated",
            onHighlightUpdated ? (start: Gtk.TextIter, end: Gtk.TextIter) => onHighlightUpdated(start, end) : null,
        );
    }
}
