import type { MarkdownRenderer } from "vitepress";

const OPTION_HEADERS = new Set(["Option", "Tool"]);
const FIGURE_IMAGE = /<img class="(result-(?:light|dark))" src="([^"]+)" width="(\d+)"([^>]*)>/g;
const PHONE_COLUMN = 400;

/**
 * Marks tables whose first header is "Option" or "Tool" with `option-table` and labels each cell with its column
 * header, so the phone stylesheet can stack every row into an entry.
 */
const optionTables = (md: MarkdownRenderer): void => {
    md.core.ruler.push("gtkx_option_tables", (state) => {
        let table: (typeof state.tokens)[number] | undefined;
        let labels: string[] = [];
        let column = 0;
        let inHead = false;

        for (const token of state.tokens) {
            switch (token.type) {
                case "table_open":
                    table = token;
                    labels = [];
                    break;
                case "thead_open":
                    inHead = true;
                    break;
                case "thead_close":
                    inHead = false;
                    if (OPTION_HEADERS.has(labels[0] ?? "")) {
                        table?.attrJoin("class", "option-table");
                    } else {
                        labels = [];
                    }
                    break;
                case "inline":
                    if (inHead) {
                        labels.push(token.content.trim());
                    }
                    break;
                case "tr_open":
                    column = 0;
                    break;
                case "td_open": {
                    const label = labels[column];
                    if (label) {
                        token.attrSet("data-label", label);
                    }
                    column += 1;
                    break;
                }
            }
        }
    });
};

/**
 * Wraps each window capture in a `figure.result` that is wider than a phone column in a link to the image, so phone
 * readers can open it at full size.
 */
const figureLinks = (md: MarkdownRenderer): void => {
    md.core.ruler.push("gtkx_figure_links", (state) => {
        for (const token of state.tokens) {
            if (token.type === "html_block" && token.content.startsWith('<figure class="result">')) {
                token.content = token.content.replace(
                    FIGURE_IMAGE,
                    (image: string, theme: string, src: string, width: string, rest: string) =>
                        Number(width) > PHONE_COLUMN
                            ? `<a class="${theme} result-full" href="${src}"><img src="${src}" width="${width}"${rest}></a>`
                            : image,
                );
            }
        }
    });
};

export { figureLinks, optionTables };
