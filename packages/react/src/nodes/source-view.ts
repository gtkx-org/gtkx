import type * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { signalStore } from "./internal/signal-store.js";
import { isContainerType } from "./internal/utils.js";
import { TextViewNode } from "./text-view.js";

type SourceViewProps = Props & {
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

class SourceViewNode extends TextViewNode {
    public static override priority = 1;

    protected declare buffer?: GtkSource.Buffer;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return isContainerType(GtkSource.View, containerOrClass);
    }

    protected override createBuffer(): GtkSource.Buffer {
        return new GtkSource.Buffer();
    }

    public override updateProps(oldProps: SourceViewProps | null, newProps: SourceViewProps): void {
        super.updateProps(oldProps, newProps);
        this.updateSourceViewProps(oldProps, newProps);
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

    private updateSourceViewProps(oldProps: SourceViewProps | null, newProps: SourceViewProps): void {
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

        const buffer = this.ensureBuffer() as GtkSource.Buffer;

        if (!oldProps || oldProps.language !== newProps.language) {
            if (newProps.language !== undefined) {
                const language = this.resolveLanguage(newProps.language);
                buffer.setLanguage(language);
            } else if (oldProps?.language !== undefined) {
                buffer.setLanguage(null);
            }
        }

        if (!oldProps || oldProps.styleScheme !== newProps.styleScheme) {
            if (newProps.styleScheme !== undefined) {
                const scheme = this.resolveStyleScheme(newProps.styleScheme);
                buffer.setStyleScheme(scheme);
            } else if (oldProps?.styleScheme !== undefined) {
                buffer.setStyleScheme(null);
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
            oldProps.onCursorMoved !== newProps.onCursorMoved ||
            oldProps.onHighlightUpdated !== newProps.onHighlightUpdated
        ) {
            this.updateSourceViewSignalHandlers(newProps);
        }
    }

    private updateSourceViewSignalHandlers(props: SourceViewProps): void {
        if (!this.buffer) return;

        const buffer = this.buffer;
        const { onCursorMoved, onHighlightUpdated } = props;

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
