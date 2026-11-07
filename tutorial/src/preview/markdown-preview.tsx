import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { useTranslation } from "@gtkx/i18n";
import { AdwClamp } from "@gtkx/jsx/adw";
import { GtkBox, GtkLabel, GtkScrolledWindow, GtkSeparator } from "@gtkx/jsx/gtk";
import type { Blockquote, Code, Heading, List, Paragraph, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { createContext, use, useMemo } from "react";
import { toMarkup } from "./markup.js";

const LinkContext = createContext<(uri: string) => boolean>(() => false);

const HEADING_CLASSES = ["title-1", "title-2", "title-3", "title-4", "heading", "heading"];

type TextBlockProps = { markup: string; cssClasses?: string[]; accessibleRole?: Gtk.AccessibleRole };

const TextBlock = ({ markup, cssClasses = [], accessibleRole = Gtk.AccessibleRole.LABEL }: TextBlockProps) => {
    const onLink = use(LinkContext);

    return (
        <GtkLabel
            accessibleRole={accessibleRole}
            label={markup}
            useMarkup
            wrap
            wrapMode={Pango.WrapMode.WORD_CHAR}
            xalign={0}
            cssClasses={cssClasses}
            onActivateLink={(uri) => onLink(uri)}
        />
    );
};

const HeadingBlock = ({ node }: { node: Heading }) => (
    <TextBlock
        accessibleRole={Gtk.AccessibleRole.HEADING}
        markup={toMarkup(node.children)}
        cssClasses={[HEADING_CLASSES[node.depth - 1] ?? "heading"]}
    />
);

const ParagraphBlock = ({ node }: { node: Paragraph }) => <TextBlock markup={toMarkup(node.children)} />;

const CodeBlock = ({ node }: { node: Code }) => (
    <GtkBox cssClasses={["card"]}>
        <GtkLabel
            label={node.value}
            selectable
            wrap
            wrapMode={Pango.WrapMode.WORD_CHAR}
            xalign={0}
            hexpand
            marginTop={12}
            marginBottom={12}
            marginStart={12}
            marginEnd={12}
            cssClasses={["monospace"]}
        />
    </GtkBox>
);

const QuoteBlock = ({ node }: { node: Blockquote }) => (
    <GtkBox spacing={12}>
        <GtkSeparator orientation={Gtk.Orientation.VERTICAL} />
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} hexpand cssClasses={["dim-label"]}>
            <Blocks nodes={node.children} />
        </GtkBox>
    </GtkBox>
);

const ListBlock = ({ node }: { node: List }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={node.spread ? 12 : 6}>
        {node.children.map((item, index) => (
            <GtkBox key={index} spacing={8}>
                <GtkLabel
                    label={node.ordered ? `${(node.start ?? 1) + index}.` : "•"}
                    valign={Gtk.Align.START}
                    widthChars={2}
                    xalign={1}
                />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} hexpand>
                    <Blocks nodes={item.children} />
                </GtkBox>
            </GtkBox>
        ))}
    </GtkBox>
);

const Block = ({ node }: { node: RootContent }) => {
    switch (node.type) {
        case "heading":
            return <HeadingBlock node={node} />;
        case "paragraph":
            return <ParagraphBlock node={node} />;
        case "code":
            return <CodeBlock node={node} />;
        case "blockquote":
            return <QuoteBlock node={node} />;
        case "list":
            return <ListBlock node={node} />;
        case "thematicBreak":
            return <GtkSeparator />;
        case "html":
            return <TextBlock markup={toMarkup([node])} cssClasses={["monospace", "dim-label"]} />;
        default:
            return null;
    }
};

const Blocks = ({ nodes }: { nodes: RootContent[] }) => nodes.map((node, index) => <Block key={index} node={node} />);

const Tags = ({ tags }: { tags: string[] }) => (
    <GtkBox spacing={12}>
        {tags.map((tag) => (
            <GtkLabel key={tag} label={`#${tag}`} cssClasses={["caption-heading", "accent"]} />
        ))}
    </GtkBox>
);

type MarkdownPreviewProps = {
    text: string;
    tags?: string[];
    onActivateLink?: (uri: string) => boolean;
};

const MarkdownPreview = ({ text, tags = [], onActivateLink = () => false }: MarkdownPreviewProps) => {
    const { t } = useTranslation();
    const tree = useMemo(() => fromMarkdown(text), [text]);

    return (
        <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
            <AdwClamp maximumSize={720}>
                <GtkBox
                    accessibleRole={Gtk.AccessibleRole.DOCUMENT}
                    accessibleLabel={t("Preview")}
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={18}
                    marginBottom={18}
                    marginStart={18}
                    marginEnd={18}
                >
                    {tags.length > 0 && <Tags tags={tags} />}
                    <LinkContext value={onActivateLink}>
                        <Blocks nodes={tree.children} />
                    </LinkContext>
                </GtkBox>
            </AdwClamp>
        </GtkScrolledWindow>
    );
};

export { MarkdownPreview };
