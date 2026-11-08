import { createContentLoader } from "vitepress";
import { BLOG_ROOT, type BlogPost, blogPost, sortPosts } from "./blog.js";

declare const data: BlogPost[];
export { data };

export default createContentLoader(`${BLOG_ROOT}/*.md`, {
    transform: (pages) =>
        sortPosts(
            pages.filter((page) => page.url !== `/${BLOG_ROOT}/`).map((page) => blogPost(page.url, page.frontmatter)),
        ),
});
