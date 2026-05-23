import type * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import type { GtkSourceViewProps } from "../jsx.js";
import { hasChanged } from "./internal/props.js";
import { TextBufferController } from "./internal/text-buffer-controller.js";
import { TextViewNode } from "./text-view.js";

type SourceViewProps = Pick<
    GtkSourceViewProps,
    | "enableUndo"
    | "onBufferChanged"
    | "onTextInserted"
    | "onTextDeleted"
    | "onCanUndoChanged"
    | "onCanRedoChanged"
    | "language"
    | "styleScheme"
    | "highlightSyntax"
    | "highlightMatchingBrackets"
    | "implicitTrailingNewline"
    | "onCursorMoved"
    | "onHighlightUpdated"
>;

interface BufferPropChanges {
    readonly languageChanged: boolean;
    readonly styleSchemeChanged: boolean;
    readonly highlightSyntaxChanged: boolean;
    readonly highlightBracketsChanged: boolean;
    readonly trailingNewlineChanged: boolean;
}

export class SourceViewNode extends TextViewNode {
    protected override createBufferController(): TextBufferController<GtkSource.Buffer> {
        return new TextBufferController<GtkSource.Buffer>(this, this.container, () => new GtkSource.Buffer());
    }

    protected override ensureBufferController(): TextBufferController<GtkSource.Buffer> {
        return super.ensureBufferController() as TextBufferController<GtkSource.Buffer>;
    }

    public override commitUpdate(oldProps: SourceViewProps | null, newProps: SourceViewProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
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

    private applyOwnProps(oldProps: SourceViewProps | null, newProps: SourceViewProps): void {
        if (hasChanged(oldProps, newProps, "onCursorMoved") || hasChanged(oldProps, newProps, "onHighlightUpdated")) {
            this.applySignalProps(newProps);
        }

        this.applyBufferProps(oldProps, newProps);
    }

    private applyBufferProps(oldProps: SourceViewProps | null, newProps: SourceViewProps): void {
        const changes = this.collectBufferPropChanges(oldProps, newProps);
        if (!this.anyBufferPropChanged(changes)) return;

        const buffer = this.ensureBufferController().ensureBuffer();

        if (changes.languageChanged) this.applyLanguage(buffer, oldProps, newProps);
        if (changes.styleSchemeChanged) this.applyStyleScheme(buffer, oldProps, newProps);
        if (changes.highlightSyntaxChanged || changes.languageChanged) {
            buffer.setHighlightSyntax(newProps.highlightSyntax ?? newProps.language !== undefined);
        }
        if (changes.highlightBracketsChanged) {
            buffer.setHighlightMatchingBrackets(newProps.highlightMatchingBrackets ?? true);
        }
        if (changes.trailingNewlineChanged && newProps.implicitTrailingNewline !== undefined) {
            buffer.setImplicitTrailingNewline(newProps.implicitTrailingNewline);
        }
    }

    private collectBufferPropChanges(oldProps: SourceViewProps | null, newProps: SourceViewProps): BufferPropChanges {
        return {
            languageChanged: hasChanged(oldProps, newProps, "language"),
            styleSchemeChanged: hasChanged(oldProps, newProps, "styleScheme"),
            highlightSyntaxChanged: hasChanged(oldProps, newProps, "highlightSyntax"),
            highlightBracketsChanged: hasChanged(oldProps, newProps, "highlightMatchingBrackets"),
            trailingNewlineChanged: hasChanged(oldProps, newProps, "implicitTrailingNewline"),
        };
    }

    private anyBufferPropChanged(changes: BufferPropChanges): boolean {
        return (
            changes.languageChanged ||
            changes.styleSchemeChanged ||
            changes.highlightSyntaxChanged ||
            changes.highlightBracketsChanged ||
            changes.trailingNewlineChanged
        );
    }

    private applyLanguage(buffer: GtkSource.Buffer, oldProps: SourceViewProps | null, newProps: SourceViewProps): void {
        if (newProps.language !== undefined) {
            buffer.setLanguage(this.resolveLanguage(newProps.language));
        } else if (oldProps?.language !== undefined) {
            buffer.setLanguage(null);
        }
    }

    private applyStyleScheme(
        buffer: GtkSource.Buffer,
        oldProps: SourceViewProps | null,
        newProps: SourceViewProps,
    ): void {
        if (newProps.styleScheme !== undefined) {
            buffer.setStyleScheme(this.resolveStyleScheme(newProps.styleScheme));
        } else if (oldProps?.styleScheme !== undefined) {
            buffer.setStyleScheme(null);
        }
    }

    private applySignalProps(props: SourceViewProps): void {
        const buffer = this.ensureBufferController().getBuffer();
        if (!buffer) return;

        const { onCursorMoved, onHighlightUpdated } = props;

        this.signalStore.set({ owner: this, obj: buffer, signal: "cursor-moved", handler: onCursorMoved });

        this.signalStore.set({
            owner: this,
            obj: buffer,
            signal: "highlight-updated",
            handler: onHighlightUpdated
                ? (start: Gtk.TextIter, end: Gtk.TextIter) => onHighlightUpdated(start, end)
                : undefined,
        });
    }
}
