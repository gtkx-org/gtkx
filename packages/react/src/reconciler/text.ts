import * as Gtk from "@gtkx/gi/gtk";
import type { Props } from "./elements.js";
import type { ContentChild, ElementNode, ParentNode, TextNode } from "./node.js";
import { ELEMENT_KIND, TEXT_KIND } from "./node.js";

const charLength = (text: string): number => [...text].length;

const contentTextLength = (node: ContentChild): number => {
    if (node.kind === TEXT_KIND) return charLength(node.text);
    if (node.contentKind === "tag")
        return (node.content ?? []).reduce((sum, child) => sum + contentTextLength(child), 0);
    return node.contentKind === "anchor" ? 1 : 0;
};

const offsetOf = (nodes: ContentChild[], target: TextNode, start: number): { found: boolean; offset: number } => {
    let offset = start;
    for (const node of nodes) {
        if (node === target) return { found: true, offset };
        if (node.kind === ELEMENT_KIND && node.contentKind === "tag") {
            const nested = offsetOf(node.content ?? [], target, offset);
            if (nested.found) return nested;
            offset = nested.offset;
        } else {
            offset += contentTextLength(node);
        }
    }
    return { found: false, offset };
};

const enclosingTagNodes = (node: TextNode): ElementNode[] => {
    const nodes: ElementNode[] = [];
    let current: ParentNode | null = node.parent;
    while (current !== null && current.kind === ELEMENT_KIND) {
        if (current.contentKind === "tag") nodes.push(current);
        current = current.parent;
    }
    return nodes;
};

const dirtyHosts = new Set<ElementNode>();
const tagTables = new WeakMap<object, Gtk.TextTagTable>();

export const textRestrictionError = (text: string): Error =>
    new Error(
        `Text strings must be rendered within a <GtkLabel> or <GtkTextBuffer> element; received ${JSON.stringify(text)}`,
    );

export const acceptsText = (host: ElementNode): boolean =>
    host.contentKind === "label" || host.contentKind === "buffer" || host.contentKind === "tag";

const rootHostOf = (node: ElementNode): ElementNode | null => {
    let current: ElementNode | null = node;
    while (current !== null) {
        if (current.contentKind === "label" || current.contentKind === "buffer") return current;
        const parent: ParentNode | null = current.parent;
        current = parent !== null && parent.kind === ELEMENT_KIND ? parent : null;
    }
    return null;
};

export const markTextDirty = (host: ElementNode): void => {
    const root = rootHostOf(host);
    if (root !== null) dirtyHosts.add(root);
};

export const enclosingHost = (node: TextNode): ElementNode | null => {
    const parent = node.parent;
    return parent !== null && parent.kind === ELEMENT_KIND ? rootHostOf(parent) : null;
};

const contentIndex = (content: ContentChild[], before: ContentChild): number => {
    const index = content.indexOf(before);
    return index < 0 ? content.length : index;
};

export const addContent = (host: ElementNode, child: ContentChild, before: ContentChild | null): void => {
    const content = host.content ?? [];
    host.content = content;
    const existing = content.indexOf(child);
    if (existing >= 0) content.splice(existing, 1);
    content.splice(before === null ? content.length : contentIndex(content, before), 0, child);
    child.parent = host;
    markTextDirty(host);
};

export const removeContent = (host: ElementNode, child: ContentChild): void => {
    const content = host.content;
    if (content === undefined || content === null) return;
    const index = content.indexOf(child);
    if (index >= 0) content.splice(index, 1);
    markTextDirty(host);
};

export const validateContentMix = (node: ElementNode, props: Props): void => {
    if (node.content === null || node.content.length === 0) return;
    if (node.contentKind === "label" && props.label !== undefined) {
        throw new Error("<GtkLabel> cannot mix a `label` prop with text children; use one or the other");
    }
    if (node.contentKind === "buffer" && props.text !== undefined) {
        throw new Error("<GtkTextBuffer> cannot mix a `text` prop with content children; use one or the other");
    }
};

const detachTag = (tag: Gtk.TextTag, table: Gtk.TextTagTable, name: string | null): void => {
    const previous = tagTables.get(tag);
    if (previous !== undefined && previous !== table) previous.remove(tag);
    if (name === null) return;
    const existing = table.lookup(name);
    if (existing !== null && existing !== tag) table.remove(existing);
};

const ensureTag = (table: Gtk.TextTagTable, node: ElementNode): void => {
    const tag = node.object;
    if (!(tag instanceof Gtk.TextTag) || tagTables.get(tag) === table) return;
    const name = typeof node.props.name === "string" ? node.props.name : null;
    detachTag(tag, table, name);
    if (name === null || table.lookup(name) !== tag) table.add(tag);
    tagTables.set(tag, table);
};

type BufferBuild = {
    buffer: Gtk.TextBuffer;
    view: Gtk.TextView | null;
    marks: { node: ElementNode; offset: number }[];
};

const insertTag = (build: BufferBuild, node: ElementNode): void => {
    const start = build.buffer.getCharCount();
    insertContent(build, node.content ?? []);
    const tag = node.object;
    if (tag instanceof Gtk.TextTag) {
        ensureTag(build.buffer.getTagTable(), node);
        build.buffer.applyTag(tag, build.buffer.getIterAtOffset(start), build.buffer.getEndIter());
    }
};

const insertAnchor = (build: BufferBuild, node: ElementNode): void => {
    const anchor = build.buffer.createChildAnchor(build.buffer.getEndIter());
    const child = node.content?.[0];
    if (build.view !== null && child?.kind === ELEMENT_KIND && child.object instanceof Gtk.Widget) {
        build.view.addChildAtAnchor(child.object, anchor);
    }
};

const insertElement = (build: BufferBuild, node: ElementNode): void => {
    if (node.contentKind === "tag") insertTag(build, node);
    else if (node.contentKind === "anchor") insertAnchor(build, node);
    else build.marks.push({ node, offset: build.buffer.getCharCount() });
};

const insertContent = (build: BufferBuild, nodes: ContentChild[]): void => {
    for (const child of nodes) {
        if (child.kind === TEXT_KIND) build.buffer.insert(build.buffer.getEndIter(), child.text, -1);
        else insertElement(build, child);
    }
};

const placeMark = (buffer: Gtk.TextBuffer, node: ElementNode, offset: number): void => {
    const mark = node.object;
    if (!(mark instanceof Gtk.TextMark)) return;
    const iter = buffer.getIterAtOffset(offset);
    if (mark.getBuffer() === null) buffer.addMark(mark, iter);
    else buffer.moveMark(mark, iter);
};

const rebuildBuffer = (node: ElementNode): void => {
    const buffer = node.object;
    if (node.props.text !== undefined || !(buffer instanceof Gtk.TextBuffer)) return;
    buffer.setText("", -1);
    const build: BufferBuild = { buffer, view: node.bufferView, marks: [] };
    insertContent(build, node.content ?? []);
    for (const mark of build.marks) placeMark(buffer, mark.node, mark.offset);
};

const rebuildLabel = (node: ElementNode): void => {
    if (node.props.label !== undefined) return;
    const label = node.object;
    if (!(label instanceof Gtk.Label)) return;
    label.setLabel((node.content ?? []).map((child) => (child.kind === TEXT_KIND ? child.text : "")).join(""));
};

export const flushTextHosts = (): void => {
    for (const host of dirtyHosts) {
        if (host.contentKind === "label") rebuildLabel(host);
        else if (host.contentKind === "buffer") rebuildBuffer(host);
    }
    dirtyHosts.clear();
};

export const surgicalTextUpdate = (host: ElementNode, node: TextNode, oldText: string, newText: string): boolean => {
    const buffer = host.object;
    if (host.contentKind !== "buffer" || !(buffer instanceof Gtk.TextBuffer)) return false;
    const located = offsetOf(host.content ?? [], node, 0);
    if (!located.found) return false;
    const start = located.offset;
    buffer.delete(buffer.getIterAtOffset(start), buffer.getIterAtOffset(start + charLength(oldText)));
    buffer.insert(buffer.getIterAtOffset(start), newText, -1);
    const range = [buffer.getIterAtOffset(start), buffer.getIterAtOffset(start + charLength(newText))] as const;
    for (const tagNode of enclosingTagNodes(node)) {
        ensureTag(buffer.getTagTable(), tagNode);
        if (tagNode.object instanceof Gtk.TextTag) buffer.applyTag(tagNode.object, range[0], range[1]);
    }
    return true;
};
