import type * as Gtk from "@gtkx/gi/gtk";

export type Mutate = (fn: () => void) => void;

export type LeafSlot = { kind: "leaf"; entry: Gtk.TextMark; exit: Gtk.TextMark; text: string };

export type TagSlot = { kind: "tag"; entry: Gtk.TextMark; exit: Gtk.TextMark };

export type AnchorSlot = { kind: "anchor"; anchor: Gtk.TextChildAnchor; attachedWidget: Gtk.Widget | null };

export type MarkSlot = { kind: "mark" };

export type Slot = LeafSlot | TagSlot | AnchorSlot | MarkSlot;

const ENTRY_MARK_LEFT_GRAVITY = false;

const EXIT_MARK_LEFT_GRAVITY = true;

export const markOffset = (buffer: Gtk.TextBuffer, mark: Gtk.TextMark): number =>
    buffer.getIterAtMark(mark).getOffset();

const createBracket = (
    buffer: Gtk.TextBuffer,
    startOffset: number,
    endOffset: number,
): { entry: Gtk.TextMark; exit: Gtk.TextMark } => ({
    entry: buffer.createMark(null, buffer.getIterAtOffset(startOffset), ENTRY_MARK_LEFT_GRAVITY),
    exit: buffer.createMark(null, buffer.getIterAtOffset(endOffset), EXIT_MARK_LEFT_GRAVITY),
});

const deleteBracketRange = (buffer: Gtk.TextBuffer, slot: LeafSlot | TagSlot, mutate: Mutate): void => {
    const start = buffer.getIterAtMark(slot.entry);
    const end = buffer.getIterAtMark(slot.exit);
    if (!start.equal(end)) mutate(() => buffer.delete(start, end));
};

const releaseBracket = (buffer: Gtk.TextBuffer, slot: LeafSlot | TagSlot): void => {
    buffer.deleteMark(slot.entry);
    buffer.deleteMark(slot.exit);
};

const insertTextAt = (buffer: Gtk.TextBuffer, atOffset: number, text: string, mutate: Mutate): void => {
    if (text.length > 0) mutate(() => buffer.insert(buffer.getIterAtOffset(atOffset), text, -1));
};

export const mountLeaf = (buffer: Gtk.TextBuffer, text: string, atOffset: number, mutate: Mutate): LeafSlot => {
    insertTextAt(buffer, atOffset, text, mutate);
    return { kind: "leaf", ...createBracket(buffer, atOffset, atOffset + text.length), text };
};

export const replaceLeafText = (buffer: Gtk.TextBuffer, slot: LeafSlot, text: string, mutate: Mutate): void => {
    deleteBracketRange(buffer, slot, mutate);
    const atOffset = markOffset(buffer, slot.entry);
    insertTextAt(buffer, atOffset, text, mutate);
    buffer.moveMark(slot.entry, buffer.getIterAtOffset(atOffset));
    buffer.moveMark(slot.exit, buffer.getIterAtOffset(atOffset + text.length));
    slot.text = text;
};

export const teardownLeaf = (buffer: Gtk.TextBuffer, slot: LeafSlot, mutate: Mutate): void => {
    deleteBracketRange(buffer, slot, mutate);
    releaseBracket(buffer, slot);
};

export const registerTag = (buffer: Gtk.TextBuffer, tag: Gtk.TextTag): void => {
    const table = buffer.getTagTable();
    if (tag.name === null || table.lookup(tag.name) === null) table.add(tag);
};

export const createTagBracket = (buffer: Gtk.TextBuffer, startOffset: number, endOffset: number): TagSlot => ({
    kind: "tag",
    ...createBracket(buffer, startOffset, endOffset),
});

export const teardownTagBracket = (buffer: Gtk.TextBuffer, tag: Gtk.TextTag, slot: TagSlot, mutate: Mutate): void => {
    deleteBracketRange(buffer, slot, mutate);
    releaseBracket(buffer, slot);
    const table = buffer.getTagTable();
    if (tag.name === null || table.lookup(tag.name) === tag) table.remove(tag);
};

export const applyTagRange = (
    buffer: Gtk.TextBuffer,
    tag: Gtk.TextTag,
    range: { start: number; end: number },
    mutate: Mutate,
): void => {
    if (range.end <= range.start) return;
    mutate(() => buffer.applyTag(tag, buffer.getIterAtOffset(range.start), buffer.getIterAtOffset(range.end)));
};

export const anchorOffset = (buffer: Gtk.TextBuffer, anchor: Gtk.TextChildAnchor): number =>
    buffer.getIterAtChildAnchor(anchor).getOffset();

export const insertAnchorAt = (
    buffer: Gtk.TextBuffer,
    anchor: Gtk.TextChildAnchor,
    atOffset: number,
    mutate: Mutate,
): void => {
    mutate(() => buffer.insertChildAnchor(buffer.getIterAtOffset(atOffset), anchor));
};

export const deleteAnchorChar = (buffer: Gtk.TextBuffer, anchor: Gtk.TextChildAnchor, mutate: Mutate): void => {
    if (anchor.getDeleted()) return;
    const start = buffer.getIterAtChildAnchor(anchor);
    const end = buffer.getIterAtChildAnchor(anchor);
    end.forwardChar();
    mutate(() => buffer.delete(start, end));
};
