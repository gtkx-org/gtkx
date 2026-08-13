import { describe, expect, it } from "vitest";
import { renderMetainfo } from "../../../src/deploy/freedesktop/metainfo.js";
import { tutorialSettings } from "../fixtures/settings.js";

const TUTORIAL_METAINFO = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<component type="desktop-application">',
    "    <id>com.gtkx.tutorial</id>",
    "    <name>Tasks</name>",
    "    <summary>Manage your tasks and to-dos</summary>",
    "    <metadata_license>CC0-1.0</metadata_license>",
    "    <project_license>MPL-2.0</project_license>",
    '    <developer id="dev.gtkx">',
    "        <name>GTKX</name>",
    "    </developer>",
    "    <description>",
    "        <p>A task manager built with GTKX.</p>",
    "    </description>",
    '    <launchable type="desktop-id">com.gtkx.tutorial.desktop</launchable>',
    "    <provides>",
    "        <binary>gtkx-tutorial</binary>",
    "    </provides>",
    "    <categories>",
    "        <category>Office</category>",
    "        <category>ProjectManagement</category>",
    "    </categories>",
    "    <keywords>",
    "        <keyword>Task</keyword>",
    "        <keyword>Todo</keyword>",
    "    </keywords>",
    '    <url type="homepage">https://gtkx.dev</url>',
    '    <url type="bugtracker">https://github.com/gtkx-org/gtkx/issues</url>',
    "    <screenshots>",
    '        <screenshot type="default">',
    "            <image>https://example.com/one.png</image>",
    "            <caption>Browsing</caption>",
    "        </screenshot>",
    "        <screenshot>",
    "            <image>https://example.com/two.png</image>",
    "        </screenshot>",
    "    </screenshots>",
    "    <releases>",
    '        <release version="1.0.0" date="2026-07-13">',
    "            <description>",
    "                <p>Initial release.</p>",
    "            </description>",
    "        </release>",
    "    </releases>",
    '    <content_rating type="oars-1.1"/>',
    "    <branding>",
    '        <color type="primary" scheme_preference="light">#3584e4</color>',
    '        <color type="primary" scheme_preference="dark">#1a5fb4</color>',
    "    </branding>",
    "</component>",
    "",
].join("\n");

describe("renderMetainfo", () => {
    it("writes the whole component for the tutorial", () => {
        expect(renderMetainfo(tutorialSettings())).toBe(TUTORIAL_METAINFO);
    });

    it("escapes markup in text and attributes", () => {
        const rendered = renderMetainfo(tutorialSettings({ name: 'A & B <c> "d"' }));
        expect(rendered).toContain("<name>A &amp; B &lt;c&gt; &quot;d&quot;</name>");
    });

    it("omits sections the app does not configure", () => {
        const rendered = renderMetainfo(tutorialSettings({
            keywords: [],
            categories: [],
            screenshots: [],
            branding: null,
            releases: [],
            urls: {},
            homepage: null,
        }));

        for (const tag of ["keywords", "categories", "screenshots", "branding", "releases", "url"]) {
            expect(rendered).not.toContain(`<${tag}`);
        }
    });

    it("lists mime types as media types the app provides", () => {
        expect(renderMetainfo(tutorialSettings({ mimeTypes: ["text/plain"] })))
            .toContain("<mediatype>text/plain</mediatype>");
    });

    it("writes content rating attributes when configured", () => {
        const rendered = renderMetainfo(tutorialSettings({ contentRating: { "violence-cartoon": "mild" } }));
        expect(rendered).toContain('<content_attribute id="violence-cartoon">mild</content_attribute>');
    });

    it("marks only one screenshot as the default", () => {
        const rendered = renderMetainfo(tutorialSettings());
        expect(rendered.match(/type="default"/g)).toHaveLength(1);
    });

    it("drops the developer id attribute when it could not be derived", () => {
        const settings = tutorialSettings({ developer: { id: null, name: "GTKX", email: null } });
        expect(renderMetainfo(settings)).toContain("<developer>");
    });
});
