import type * as GObject from "@gtkx/gi/gobject";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { drain, indexBeforeOrEnd } from "@gtkx/utils";
import type { ContentChild, ContentKind, ElementNode, ParentNode, TextNode } from "./node.js";
import type { Props } from "./registry.js";
import { ELEMENT_KIND, TEXT_KIND } from "./node.js";
import { applyWrite } from "./signals.js";

type OffsetResult = { wasFound: boolean; offset: number };

type BufferBuild = {
    buffer: Gtk.TextBuffer;
    view: Gtk.TextView | null;
    marks: { node: ElementNode; offset: number }[];
};

const dirtyHosts: Set<ElementNode> = new Set();
const tagTables: WeakMap<object, Gtk.TextTagTable> = new WeakMap();
const TEXT_CONTENT_KINDS: Set<string> = new Set(["label", "buffer", "tag"]);
const PAINTABLE_PROP = "paintable";
const TEXT_PROP = "text";

const CONTENT_MIX_RULES: { kind: ContentKind; prop: string; message: string }[] = [
    {
        kind: "label",
        prop: "label",
        message: "<GtkLabel> cannot mix a `label` prop with text children; use one or the other",
    },
    {
        kind: "buffer",
        prop: "text",
        message: "<GtkTextBuffer> cannot mix a `text` prop with content children; use one or the other",
    },
    {
        kind: "anchor",
        prop: PAINTABLE_PROP,
        message: "<GtkTextChildAnchor> cannot mix a `paintable` prop with a child widget; use one or the other",
    },
];

const charLength = (text: string): number => text[Symbol.iterator]().toArray().length;

const bufferText = (buffer: Gtk.TextBuffer): string =>
    buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);

const currentText = (object: GObject.Object): string | null => {
    if (object instanceof Gtk.TextBuffer) {
        return bufferText(object);
    }

    if (object instanceof Gtk.Editable || object instanceof Gtk.EntryBuffer) {
        return object.getText();
    }

    return null;
};

const hasSameText = (object: GObject.Object, prop: string, value: unknown): boolean =>
    prop === TEXT_PROP && typeof value === "string" && currentText(object) === value;

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
        return { wasFound: true, offset };
    }

    if (isTagElement(node)) {
        return getOffset(node.content, target, offset);
    }

    return { wasFound: false, offset: offset + contentTextLength(node) };
};

const getOffset = (nodes: ContentChild[], target: TextNode, start: number): OffsetResult => {
    let offset = start;

    for (const node of nodes) {
        const step = stepOffset(node, target, offset);

        if (step.wasFound) {
            return step;
        }

        offset = step.offset;
    }

    return { wasFound: false, offset };
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

    const violated = CONTENT_MIX_RULES.find(
        (rule) => rule.kind === node.contentKind && props[rule.prop] !== undefined,
    );

    if (violated !== undefined) {
        throw new Error(violated.message);
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

const contentPaintable = (node: ElementNode): Gdk.Paintable | null => {
    const value = node.props[PAINTABLE_PROP];

    return value instanceof Gdk.Paintable ? value : null;
};

const isContentPaintableProp = (node: ElementNode, name: string): boolean =>
    name === PAINTABLE_PROP && node.contentKind === "anchor";

const insertAnchor = (build: BufferBuild, node: ElementNode): void => {
    const paintable = contentPaintable(node);

    if (paintable !== null) {
        build.buffer.insertPaintable(build.buffer.getEndIter(), paintable);

        return;
    }

    const anchor = node.object;

    if (!(anchor instanceof Gtk.TextChildAnchor)) {
        return;
    }

    build.buffer.insertChildAnchor(build.buffer.getEndIter(), anchor);
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

    applyWrite(() => {
        buffer.setText("", -1);
        const build: BufferBuild = { buffer, view: node.bufferView, marks: [] };
        insertContent(build, node.content);

        for (const mark of build.marks) {
            placeMark(buffer, mark.node, mark.offset);
        }
    });
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

    if (!located.wasFound) {
        return false;
    }

    const start = located.offset;

    applyWrite(() => {
        buffer.delete(buffer.getIterAtOffset(start), buffer.getIterAtOffset(start + charLength(oldText)));
        buffer.insert(buffer.getIterAtOffset(start), newText, -1);
    });

    const startIter = buffer.getIterAtOffset(start);
    const endIter = buffer.getIterAtOffset(start + charLength(newText));
    applyEnclosingTags(buffer, node, startIter, endIter);

    return true;
};

export {
    TEXT_PROP,
    textRestrictionError,
    bufferText,
    hasSameText,
    canAcceptText,
    isContentPaintableProp,
    markTextDirty,
    enclosingHost,
    addContent,
    removeContent,
    validateContentMix,
    flushTextHosts,
    didUpdateTextSurgically,
};
