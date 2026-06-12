import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const website = resolve(import.meta.dirname, "..");
const changelogPath = resolve(website, "docs/changelog.md");

interface Release {
    name: string | null;
    tag_name: string;
    published_at: string | null;
    body: string | null;
    html_url: string;
    draft: boolean;
    prerelease: boolean;
}

const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "gtkx-website-changelog",
};

if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const escapeVueInterpolation = (text: string): string =>
    text
        .split(/(`[^`\n]*`)/)
        .map((segment, index) => {
            if (index % 2 === 1) return segment.includes("{{") ? `${segment}{v-pre}` : segment;
            return segment.replace(/\{\{/g, "{<span></span>{");
        })
        .join("");

const sanitizeBody = (markdown: string): string =>
    markdown
        .replace(/\r\n?/g, "\n")
        .split(/(^```[^\n]*\n[\s\S]*?^```$)/m)
        .map((part, index) =>
            index % 2 === 1 ? part : escapeVueInterpolation(part.replace(/^(#{1,4})(?=\s)/gm, "##$1")),
        )
        .join("");

const renderRelease = (release: Release): string => {
    const title = release.name?.trim() || release.tag_name;
    const date = release.published_at ? release.published_at.slice(0, 10) : "";
    const heading = date ? `## ${title} — ${date}` : `## ${title}`;
    const body = release.body?.trim() ? `\n${sanitizeBody(release.body.trim())}\n` : "";
    return `${heading}\n${body}\n[Release notes on GitHub](${release.html_url})\n`;
};

const renderPage = (releases: Release[]): string => {
    const intro =
        releases.length > 0
            ? releases.map(renderRelease).join("\n")
            : "The v1 release notes will appear here once the first release is published.\n";
    return `---\neditLink: false\n---\n\n# Changelog\n\n${intro}`;
};

try {
    const response = await fetch("https://api.github.com/repos/gtkx-org/gtkx/releases?per_page=100", { headers });
    if (!response.ok) {
        console.log(`Changelog skipped: GitHub responded ${response.status}; keeping the committed fallback.`);
        process.exit(0);
    }
    const releases = (await response.json()) as Release[];
    const published = releases.filter((release) => !release.draft && !release.prerelease);
    writeFileSync(changelogPath, renderPage(published));
    console.log(`Changelog generated with ${published.length} release(s).`);
} catch (error) {
    console.log(`Changelog skipped: ${error instanceof Error ? error.message : error}; keeping the committed fallback.`);
}
