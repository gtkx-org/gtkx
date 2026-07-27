import * as Gtk from "@gtkx/gi/gtk";
import { drain, indexBeforeOrEnd } from "@gtkx/utils";
import type { ContentChild, ElementNode, ParentNode, TextNode } from "./node.js";
import type { Props } from "./registry.js";
import { ELEMENT_KIND, TEXT_KIND } from "./node.js";

type OffsetResult = { found: boolean; offset: number };

type BufferBuild = {
    buffer: Gtk.TextBuffer;
    view: Gtk.TextView | null;
    marks: { node: ElementNode; offset: number }[];
};

const dirtyHosts: Set<ElementNode> = new Set();
const tagTables: WeakMap<object, Gtk.TextTagTable> = new WeakMap();
const TEXT_CONTENT_KINDS: Set<string> = new Set(["label", "buffer", "tag"]);

const charLength = (text: string): number => text[Symbol.iterator]().toArray().length;

const contentTextLength = (node: ContentChild): number => {
    if (node.kind === TEXT_KIND) {
        return charLength(node.text);
    }

    if (node.contentKind === "tag") {
        return node.content.reduce((sum, child) => sum + contentTextLength(child), 0);
    }

    return node.contentKind === "anchor" ? 1 : 0;
};

const isTagElement = (node: ContentChild): node is ElementNode =>
    node.kind === ELEMENT_KIND && node.contentKind === "tag";

const stepOffset = (node: ContentChild, target: TextNode, offset: number): OffsetResult => {
    if (node === target) {
        return { found: true, offset };
    }

    if (isTagElement(node)) {
        return getOffset(node.content, target, offset);
    }

    return { found: false, offset: offset + contentTextLength(node) };
};

const getOffset = (nodes: ContentChild[], target: TextNode, start: number): OffsetResult => {
    let offset = start;

    for (const node of nodes) {
        const step = stepOffset(node, target, offset);

        if (step.found) {
            return step;
        }

        offset = step.offset;
    }

    return { found: false, offset };
};

const enclosingTagNodes = (node: TextNode): ElementNode[] => {
    const nodes: ElementNode[] = [];
    let current: ParentNode | null = node.parent;

    while (current !== null && current.kind === ELEMENT_KIND) {
        if (current.contentKind === "tag") {
            nodes.push(current);
        }

        current = current.parent;
    }

    return nodes;
};

const textRestrictionError = (text: string): Error =>
    new Error(
        "Text strings must be rendered within a <GtkLabel> or <GtkTextBuffer> element; " +
        `received ${JSON.stringify(text)}`,
    );

const canAcceptText = (host: ElementNode): boolean =>
    host.contentKind !== null && TEXT_CONTENT_KINDS.has(host.contentKind);

const isRootHost = (node: ElementNode): boolean => node.contentKind === "label" || node.contentKind === "buffer";

const mapElementParent = <T>(parent: ParentNode | null, map: (element: ElementNode) => T): T | null =>
    parent !== null && parent.kind === ELEMENT_KIND ? map(parent) : null;

const parentElement = (node: ElementNode): ElementNode | null => mapElementParent(node.parent, (parent) => parent);

const getRootHost = (node: ElementNode): ElementNode | null => {
    let current: ElementNode | null = node;

    while (current !== null) {
        if (isRootHost(current)) {
            return current;
        }

        current = parentElement(current);
    }

    return null;
};

const markTextDirty = (host: ElementNode): void => {
    const root = getRootHost(host);

    if (root !== null) {
        dirtyHosts.add(root);
    }
};

const enclosingHost = (node: TextNode): ElementNode | null => mapElementParent(node.parent, getRootHost);

const addContent = (host: ElementNode, child: ContentChild, before: ContentChild | null): void => {
    const content = host.content;
    const existing = content.indexOf(child);

    if (existing !== -1) {
        content.splice(existing, 1);
    }

    content.splice(
        indexBeforeOrEnd(content, before, (item, target) => item === target),
        0,
        child,
    );

    child.parent = host;
    markTextDirty(host);
};

const removeContent = (host: ElementNode, child: ContentChild): void => {
    const index = host.content.indexOf(child);

    if (index !== -1) {
        host.content.splice(index, 1);
    }

    markTextDirty(host);
};

const validateContentMix = (node: ElementNode, props: Props): void => {
    if (node.content.length === 0) {
        return;
    }

    if (node.contentKind === "label" && props.label !== undefined) {
        throw new Error("<GtkLabel> cannot mix a `label` prop with text children; use one or the other");
    }

    if (node.contentKind === "buffer" && props.text !== undefined) {
        throw new Error("<GtkTextBuffer> cannot mix a `text` prop with content children; use one or the other");
    }
};

const detachTag = (tag: Gtk.TextTag, table: Gtk.TextTagTable, name: string | null): void => {
    const previous = tagTables.get(tag);

    if (previous !== undefined && previous !== table) {
        previous.remove(tag);
    }

    if (name === null) {
        return;
    }

    const existing = table.lookup(name);

    if (existing !== null && existing !== tag) {
        table.remove(existing);
    }
};

const ensureTag = (table: Gtk.TextTagTable, node: ElementNode): void => {
    const tag = node.object;

    if (!(tag instanceof Gtk.TextTag) || tagTables.get(tag) === table) {
        return;
    }

    const name = typeof node.props.name === "string" ? node.props.name : null;
    detachTag(tag, table, name);

    if (name === null || table.lookup(name) !== tag) {
        table.add(tag);
    }

    tagTables.set(tag, table);
};

const insertTag = (build: BufferBuild, node: ElementNode): void => {
    const start = build.buffer.getCharCount();
    insertContent(build, node.content);
    const tag = node.object;

    if (tag instanceof Gtk.TextTag) {
        ensureTag(build.buffer.getTagTable(), node);
        build.buffer.applyTag(tag, build.buffer.getIterAtOffset(start), build.buffer.getEndIter());
    }
};

const insertAnchor = (build: BufferBuild, node: ElementNode): void => {
    const anchor = build.buffer.createChildAnchor(build.buffer.getEndIter());
    const child = node.content[0];

    if (build.view !== null && child?.kind === ELEMENT_KIND && child.object instanceof Gtk.Widget) {
        build.view.addChildAtAnchor(child.object, anchor);
    }
};

const insertElement = (build: BufferBuild, node: ElementNode): void => {
    if (node.contentKind === "tag") {
        insertTag(build, node);
    } else if (node.contentKind === "anchor") {
        insertAnchor(build, node);
    } else {
        build.marks.push({ node, offset: build.buffer.getCharCount() });
    }
};

const insertContent = (build: BufferBuild, nodes: ContentChild[]): void => {
    for (const child of nodes) {
        if (child.kind === TEXT_KIND) {
            build.buffer.insert(build.buffer.getEndIter(), child.text, -1);
        } else {
            insertElement(build, child);
        }
    }
};

const placeMark = (buffer: Gtk.TextBuffer, node: ElementNode, offset: number): void => {
    const mark = node.object;

    if (!(mark instanceof Gtk.TextMark)) {
        return;
    }

    const iter = buffer.getIterAtOffset(offset);

    if (mark.getBuffer() === null) {
        buffer.addMark(mark, iter);
    } else {
        buffer.moveMark(mark, iter);
    }
};

const rebuildBuffer = (node: ElementNode): void => {
    const buffer = node.object;

    if (node.props.text !== undefined || !(buffer instanceof Gtk.TextBuffer)) {
        return;
    }

    buffer.setText("", -1);
    const build: BufferBuild = { buffer, view: node.bufferView, marks: [] };
    insertContent(build, node.content);

    for (const mark of build.marks) {
        placeMark(buffer, mark.node, mark.offset);
    }
};

const rebuildLabel = (node: ElementNode): void => {
    if (node.props.label !== undefined) {
        return;
    }

    const label = node.object;

    if (!(label instanceof Gtk.Label)) {
        return;
    }

    label.setLabel(node.content.map((child) => (child.kind === TEXT_KIND ? child.text : "")).join(""));
};

const flushTextHosts = (): void => {
    drain(dirtyHosts, (host) => {
        if (host.contentKind === "label") {
            rebuildLabel(host);
        } else if (host.contentKind === "buffer") {
            rebuildBuffer(host);
        }
    });
};

const applyEnclosingTags = (
    buffer: Gtk.TextBuffer,
    node: TextNode,
    startIter: Gtk.TextIter,
    endIter: Gtk.TextIter,
): void => {
    for (const tagNode of enclosingTagNodes(node)) {
        ensureTag(buffer.getTagTable(), tagNode);

        if (tagNode.object instanceof Gtk.TextTag) {
            buffer.applyTag(tagNode.object, startIter, endIter);
        }
    }
};

const didUpdateTextSurgically = (host: ElementNode, node: TextNode, oldText: string, newText: string): boolean => {
    const buffer = host.object;

    if (host.contentKind !== "buffer" || !(buffer instanceof Gtk.TextBuffer)) {
        return false;
    }

    const located = getOffset(host.content, node, 0);

    if (!located.found) {
        return false;
    }

    const start = located.offset;
    buffer.delete(buffer.getIterAtOffset(start), buffer.getIterAtOffset(start + charLength(oldText)));
    buffer.insert(buffer.getIterAtOffset(start), newText, -1);
    const startIter = buffer.getIterAtOffset(start);
    const endIter = buffer.getIterAtOffset(start + charLength(newText));
    applyEnclosingTags(buffer, node, startIter, endIter);

    return true;
};

export {
    textRestrictionError,
    canAcceptText,
    markTextDirty,
    enclosingHost,
    addContent,
    removeContent,
    validateContentMix,
    flushTextHosts,
    didUpdateTextSurgically,
};
