import { batch } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import { registerNodeClass } from "../registry.js";
import { signalStore } from "./internal/signal-store.js";
import { VirtualNode } from "./virtual.js";

/**
 * Props for the SourceBuffer virtual element.
 *
 * Used to declaratively configure the text buffer for a GtkSourceView with syntax highlighting,
 * bracket matching, and other source code editing features.
 *
 * @example
 * ```tsx
 * <GtkSourceView>
 *     <x.SourceBuffer
 *         text={sourceCode}
 *         language="typescript"
 *         styleScheme="Adwaita-dark"
 *         highlightSyntax
 *         highlightMatchingBrackets
 *         onTextChanged={(text) => console.log("Code:", text)}
 *     />
 * </GtkSourceView>
 * ```
 */
export type SourceBufferProps = {
    /** Text content */
    text?: string;
    /** Whether to enable undo/redo */
    enableUndo?: boolean;
    /** Callback when the text content changes */
    onTextChanged?: (text: string) => void;
    /** Callback when can-undo state changes */
    onCanUndoChanged?: (canUndo: boolean) => void;
    /** Callback when can-redo state changes */
    onCanRedoChanged?: (canRedo: boolean) => void;

    /**
     * Language for syntax highlighting.
     * Can be a language ID string (e.g., "typescript", "python", "rust") or a GtkSource.Language object.
     */
    language?: string | GtkSource.Language;

    /**
     * Style scheme for syntax highlighting colors.
     * Can be a scheme ID string (e.g., "Adwaita-dark", "classic") or a GtkSource.StyleScheme object.
     */
    styleScheme?: string | GtkSource.StyleScheme;

    /** Whether to enable syntax highlighting. Defaults to true when language is set. */
    highlightSyntax?: boolean;

    /** Whether to highlight matching brackets when cursor is on a bracket. Defaults to true. */
    highlightMatchingBrackets?: boolean;

    /**
     * Whether the buffer has an implicit trailing newline.
     * When true (default), trailing newlines are handled automatically during file load/save.
     */
    implicitTrailingNewline?: boolean;

    /** Callback when the cursor position changes */
    onCursorMoved?: () => void;

    /** Callback when syntax highlighting is updated for a region */
    onHighlightUpdated?: (start: Gtk.TextIter, end: Gtk.TextIter) => void;
};

export class SourceBufferNode extends VirtualNode<SourceBufferProps> {
    public static override priority = 1;

    private sourceView?: GtkSource.View;
    private buffer?: GtkSource.Buffer;

    public static override matches(type: string): boolean {
        return type === "SourceBuffer";
    }

    public setSourceView(sourceView: GtkSource.View): void {
        this.sourceView = sourceView;
        this.setupBuffer();
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

    private setupBuffer(): void {
        if (!this.sourceView) return;

        this.buffer = new GtkSource.Buffer();
        this.sourceView.setBuffer(this.buffer);

        if (this.props.enableUndo !== undefined) {
            this.buffer.setEnableUndo(this.props.enableUndo);
        }

        if (this.props.text !== undefined) {
            this.buffer.setText(this.props.text, -1);
        }

        this.applySourceProps();
        this.updateSignalHandlers();
    }

    private applySourceProps(): void {
        if (!this.buffer) return;

        if (this.props.language !== undefined) {
            const language = this.resolveLanguage(this.props.language);
            this.buffer.setLanguage(language);
        }

        if (this.props.styleScheme !== undefined) {
            const scheme = this.resolveStyleScheme(this.props.styleScheme);
            this.buffer.setStyleScheme(scheme);
        }

        const highlightSyntax = this.props.highlightSyntax ?? this.props.language !== undefined;
        this.buffer.setHighlightSyntax(highlightSyntax);

        const highlightMatchingBrackets = this.props.highlightMatchingBrackets ?? true;
        this.buffer.setHighlightMatchingBrackets(highlightMatchingBrackets);

        if (this.props.implicitTrailingNewline !== undefined) {
            this.buffer.setImplicitTrailingNewline(this.props.implicitTrailingNewline);
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

    private updateSignalHandlers(): void {
        if (!this.buffer) return;

        const buffer = this.buffer;
        const { onTextChanged, onCanUndoChanged, onCanRedoChanged, onCursorMoved, onHighlightUpdated } = this.props;

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

    public override updateProps(oldProps: SourceBufferProps | null, newProps: SourceBufferProps): void {
        super.updateProps(oldProps, newProps);

        if (!this.buffer) return;

        if (!oldProps || oldProps.enableUndo !== newProps.enableUndo) {
            if (newProps.enableUndo !== undefined) {
                this.buffer.setEnableUndo(newProps.enableUndo);
            }
        }

        if (!oldProps || oldProps.text !== newProps.text) {
            if (newProps.text !== undefined) {
                const currentText = this.getBufferText();
                if (currentText !== newProps.text) {
                    this.buffer.setText(newProps.text, -1);
                }
            }
        }

        if (!oldProps || oldProps.language !== newProps.language) {
            if (newProps.language !== undefined) {
                const language = this.resolveLanguage(newProps.language);
                this.buffer.setLanguage(language);
            }
        }

        if (!oldProps || oldProps.styleScheme !== newProps.styleScheme) {
            if (newProps.styleScheme !== undefined) {
                const scheme = this.resolveStyleScheme(newProps.styleScheme);
                this.buffer.setStyleScheme(scheme);
            }
        }

        if (
            !oldProps ||
            oldProps.highlightSyntax !== newProps.highlightSyntax ||
            oldProps.language !== newProps.language
        ) {
            const highlightSyntax = newProps.highlightSyntax ?? newProps.language !== undefined;
            this.buffer.setHighlightSyntax(highlightSyntax);
        }

        if (!oldProps || oldProps.highlightMatchingBrackets !== newProps.highlightMatchingBrackets) {
            const highlightMatchingBrackets = newProps.highlightMatchingBrackets ?? true;
            this.buffer.setHighlightMatchingBrackets(highlightMatchingBrackets);
        }

        if (!oldProps || oldProps.implicitTrailingNewline !== newProps.implicitTrailingNewline) {
            if (newProps.implicitTrailingNewline !== undefined) {
                this.buffer.setImplicitTrailingNewline(newProps.implicitTrailingNewline);
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
            this.updateSignalHandlers();
        }
    }

    public override unmount(): void {
        this.buffer = undefined;
        this.sourceView = undefined;
        super.unmount();
    }
}

registerNodeClass(SourceBufferNode);
