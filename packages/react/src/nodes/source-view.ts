import type { SignalHandler } from "@gtkx/ffi";
import * as GtkSource from "@gtkx/gi/gtksource";
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

export class SourceViewNode extends TextViewNode {
    protected override createBufferController(): TextBufferController<GtkSource.Buffer> {
        return new TextBufferController<GtkSource.Buffer>(this, this.backingInstance, () => new GtkSource.Buffer());
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
        const languageChanged = hasChanged(oldProps, newProps, "language");
        const styleSchemeChanged = hasChanged(oldProps, newProps, "styleScheme");
        const highlightSyntaxChanged = hasChanged(oldProps, newProps, "highlightSyntax");
        const highlightBracketsChanged = hasChanged(oldProps, newProps, "highlightMatchingBrackets");
        const trailingNewlineChanged = hasChanged(oldProps, newProps, "implicitTrailingNewline");

        if (
            !(
                languageChanged ||
                styleSchemeChanged ||
                highlightSyntaxChanged ||
                highlightBracketsChanged ||
                trailingNewlineChanged
            )
        ) {
            return;
        }

        const buffer = this.ensureBufferController().ensureBuffer();

        if (languageChanged) this.applyLanguage(buffer, oldProps, newProps);
        if (styleSchemeChanged) this.applyStyleScheme(buffer, oldProps, newProps);
        if (highlightSyntaxChanged || languageChanged) {
            buffer.setHighlightSyntax(newProps.highlightSyntax ?? newProps.language !== undefined);
        }
        if (highlightBracketsChanged) {
            buffer.setHighlightMatchingBrackets(newProps.highlightMatchingBrackets ?? true);
        }
        if (trailingNewlineChanged && newProps.implicitTrailingNewline !== undefined) {
            buffer.setImplicitTrailingNewline(newProps.implicitTrailingNewline);
        }
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
            handler: (onHighlightUpdated ?? undefined) as SignalHandler | undefined,
        });
    }
}
