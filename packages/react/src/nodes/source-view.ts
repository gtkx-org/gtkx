import { batch } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { signalStore } from "./internal/signal-store.js";
import { isContainerType } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

type SourceViewProps = Props & {
    text?: string;
    enableUndo?: boolean;
    onTextChanged?: ((text: string) => void) | null;
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

class SourceViewNode extends WidgetNode<GtkSource.View, SourceViewProps> {
    public static override priority = 1;

    private buffer?: GtkSource.Buffer;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return isContainerType(GtkSource.View, containerOrClass);
    }

    public override updateProps(oldProps: SourceViewProps | null, newProps: SourceViewProps): void {
        super.updateProps(oldProps, newProps);
        this.updateBufferProps(oldProps, newProps);
    }

    private ensureBuffer(): GtkSource.Buffer {
        if (!this.buffer) {
            this.buffer = new GtkSource.Buffer();
            this.container.setBuffer(this.buffer);
        }
        return this.buffer;
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

    private updateBufferProps(oldProps: SourceViewProps | null, newProps: SourceViewProps): void {
        const hasBufferProps =
            newProps.text !== undefined ||
            newProps.enableUndo !== undefined ||
            newProps.onTextChanged !== undefined ||
            newProps.onCanUndoChanged !== undefined ||
            newProps.onCanRedoChanged !== undefined ||
            newProps.language !== undefined ||
            newProps.styleScheme !== undefined ||
            newProps.highlightSyntax !== undefined ||
            newProps.highlightMatchingBrackets !== undefined ||
            newProps.implicitTrailingNewline !== undefined ||
            newProps.onCursorMoved !== undefined ||
            newProps.onHighlightUpdated !== undefined;

        if (!hasBufferProps) {
            return;
        }

        const buffer = this.ensureBuffer();

        if (!oldProps || oldProps.enableUndo !== newProps.enableUndo) {
            if (newProps.enableUndo !== undefined) {
                buffer.setEnableUndo(newProps.enableUndo);
            }
        }

        if (!oldProps || oldProps.text !== newProps.text) {
            if (newProps.text !== undefined) {
                const currentText = this.getBufferText();
                if (currentText !== newProps.text) {
                    buffer.setText(newProps.text, -1);
                }
            }
        }

        if (!oldProps || oldProps.language !== newProps.language) {
            if (newProps.language !== undefined) {
                const language = this.resolveLanguage(newProps.language);
                buffer.setLanguage(language);
            }
        }

        if (!oldProps || oldProps.styleScheme !== newProps.styleScheme) {
            if (newProps.styleScheme !== undefined) {
                const scheme = this.resolveStyleScheme(newProps.styleScheme);
                buffer.setStyleScheme(scheme);
            }
        }

        if (
            !oldProps ||
            oldProps.highlightSyntax !== newProps.highlightSyntax ||
            oldProps.language !== newProps.language
        ) {
            const highlightSyntax = newProps.highlightSyntax ?? newProps.language !== undefined;
            buffer.setHighlightSyntax(highlightSyntax);
        }

        if (!oldProps || oldProps.highlightMatchingBrackets !== newProps.highlightMatchingBrackets) {
            const highlightMatchingBrackets = newProps.highlightMatchingBrackets ?? true;
            buffer.setHighlightMatchingBrackets(highlightMatchingBrackets);
        }

        if (!oldProps || oldProps.implicitTrailingNewline !== newProps.implicitTrailingNewline) {
            if (newProps.implicitTrailingNewline !== undefined) {
                buffer.setImplicitTrailingNewline(newProps.implicitTrailingNewline);
            }
        }

        if (
            !oldProps ||
            oldProps.onTextChanged !== newProps.onTextChanged ||
            oldProps.onCanUndoChanged !== newProps.onCanUndoChanged ||
            oldProps.onCanRedoChanged !== newProps.onCanRedoChanged ||
            oldProps.onCursorMoved !== newProps.onCursorMoved ||
            oldProps.onHighlightUpdated !== newProps.onHighlightUpdated
        ) {
            this.updateSignalHandlers(newProps);
        }
    }

    private getBufferText(): string {
        const buffer = this.buffer;
        if (!buffer) return "";
        const startIter = new Gtk.TextIter();
        const endIter = new Gtk.TextIter();
        batch(() => {
            buffer.getStartIter(startIter);
            buffer.getEndIter(endIter);
        });
        return buffer.getText(startIter, endIter, true);
    }

    private updateSignalHandlers(props: SourceViewProps): void {
        if (!this.buffer) return;

        const buffer = this.buffer;
        const { onTextChanged, onCanUndoChanged, onCanRedoChanged, onCursorMoved, onHighlightUpdated } = props;

        signalStore.set(this, buffer, "changed", onTextChanged ? () => onTextChanged(this.getBufferText()) : null);

        signalStore.set(
            this,
            buffer,
            "notify::can-undo",
            onCanUndoChanged ? () => onCanUndoChanged(buffer.getCanUndo()) : null,
        );

        signalStore.set(
            this,
            buffer,
            "notify::can-redo",
            onCanRedoChanged ? () => onCanRedoChanged(buffer.getCanRedo()) : null,
        );

        signalStore.set(this, buffer, "cursor-moved", onCursorMoved ?? null);

        signalStore.set(
            this,
            buffer,
            "highlight-updated",
            onHighlightUpdated
                ? (_buffer: GtkSource.Buffer, start: Gtk.TextIter, end: Gtk.TextIter) => onHighlightUpdated(start, end)
                : null,
        );
    }
}

registerNodeClass(SourceViewNode);
