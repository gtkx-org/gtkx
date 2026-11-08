import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

/**
 * A blog post as listed in the blog index, the blog sidebar and the RSS feed.
 */
export interface BlogPost {
    url: string;
    title: string;
    label: string;
    description: string;
    date: string;
    displayDate: string;
}

export const BLOG_ROOT = "blog";
export const BLOG_FEED = "blog.rss";
export const BLOG_TITLE = "GTKX Blog";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

const frontmatterText = (url: string, frontmatter: Record<string, unknown>, key: string): string => {
    const value = frontmatter[key];

    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${url} needs a "${key}" in its front matter.`);
    }

    return value;
};

const frontmatterDate = (url: string, frontmatter: Record<string, unknown>): string => {
    const value = frontmatter.date;
    const date = value instanceof Date ? value.toISOString().slice(0, 10) : value;

    if (typeof date !== "string" || !ISO_DATE.test(date)) {
        throw new Error(`Blog post ${url} needs a "date" in YYYY-MM-DD form in its front matter.`);
    }

    return date;
};

const displayDate = (date: string): string =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" });

/**
 * Reads a post's listing metadata from its front matter.
 */
export const blogPost = (url: string, frontmatter: Record<string, unknown>): BlogPost => {
    const date = frontmatterDate(url, frontmatter);

    return {
        url,
        title: frontmatterText(url, frontmatter, "title"),
        label: frontmatterText(url, frontmatter, "label"),
        description: frontmatterText(url, frontmatter, "description"),
        date,
        displayDate: displayDate(date),
    };
};

/**
 * Orders posts newest first.
 */
export const sortPosts = (posts: BlogPost[]): BlogPost[] =>
    posts.toSorted((left, right) => right.date.localeCompare(left.date) || left.url.localeCompare(right.url));

const readFrontmatter = (path: string): Record<string, unknown> => {
    const match = FRONTMATTER.exec(readFileSync(path, "utf8"));

    return match ? (parse(match[1]) as Record<string, unknown>) : {};
};

/**
 * Reads every post under `blog/` for configuration that runs before VitePress can load content.
 */
export const readBlogPosts = (srcDir: string): BlogPost[] => {
    const directory = join(srcDir, BLOG_ROOT);
    const posts = readdirSync(directory)
        .filter((file) => file.endsWith(".md") && file !== "index.md")
        .map((file) => blogPost(`/${BLOG_ROOT}/${file.replace(/\.md$/, "")}`, readFrontmatter(join(directory, file))));

    return sortPosts(posts);
};

const escapeXml = (text: string): string => text.replace(/[<>&"']/g, (character) => `&#${character.charCodeAt(0)};`);

const rfc822 = (date: string): string => new Date(`${date}T00:00:00Z`).toUTCString();

const blogFeed = (siteUrl: string, description: string, posts: BlogPost[]): string => {
    const items = posts.map((post) =>
        [
            "    <item>",
            `      <title>${escapeXml(post.title)}</title>`,
            `      <link>${siteUrl}${post.url}</link>`,
            `      <guid isPermaLink="true">${siteUrl}${post.url}</guid>`,
            `      <pubDate>${rfc822(post.date)}</pubDate>`,
            `      <description>${escapeXml(post.description)}</description>`,
            "    </item>",
        ].join("\n"),
    );
    const latest = posts[0];

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        "  <channel>",
        `    <title>${BLOG_TITLE}</title>`,
        `    <link>${siteUrl}/${BLOG_ROOT}/</link>`,
        `    <description>${escapeXml(description)}</description>`,
        "    <language>en</language>",
        `    <atom:link href="${siteUrl}/${BLOG_FEED}" rel="self" type="application/rss+xml"/>`,
        ...(latest ? [`    <lastBuildDate>${rfc822(latest.date)}</lastBuildDate>`] : []),
        ...items,
        "  </channel>",
        "</rss>",
        "",
    ].join("\n");
};

/**
 * Renders the blog's posts as an RSS 2.0 feed, described by the blog index's front matter.
 */
export const readBlogFeed = (srcDir: string, siteUrl: string): string => {
    const index = `/${BLOG_ROOT}/`;
    const description = frontmatterText(index, readFrontmatter(join(srcDir, BLOG_ROOT, "index.md")), "description");

    return blogFeed(siteUrl, description, readBlogPosts(srcDir));
};
