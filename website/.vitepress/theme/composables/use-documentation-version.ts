import { useData } from "vitepress";
import { computed, type ComputedRef } from "vue";
import { documentationLink, type DocumentationVersion, GUIDE_ROOT, rootVersion, versions } from "../../versioning.js";

type VersionLink = {
    href: string;
    samePage: boolean;
};

type DocumentationVersionContext = {
    version: ComputedRef<DocumentationVersion>;
    link: (target: DocumentationVersion) => string;
    isSamePage: (target: DocumentationVersion) => boolean;
};

const isVersionLink = (value: unknown): value is VersionLink =>
    typeof value === "object" && value !== null && "href" in value && typeof value.href === "string";

const readLinks = (value: unknown): Map<string, VersionLink> => {
    if (typeof value !== "object" || value === null) {
        return new Map();
    }

    return new Map(Object.entries(value).filter((entry): entry is [string, VersionLink] => isVersionLink(entry[1])));
};

const useDocumentationVersion = (): DocumentationVersionContext => {
    const { frontmatter } = useData();
    const links = computed(() => readLinks(frontmatter.value.versionLinks));
    const version = computed(() => {
        const declared: unknown = frontmatter.value.versionId;

        return versions.find((entry) => entry.id === declared) ?? rootVersion;
    });

    return {
        version,
        link: (target) => links.value.get(target.id)?.href ?? documentationLink(target, GUIDE_ROOT),
        isSamePage: (target) => links.value.get(target.id)?.samePage ?? false,
    };
};

export { type DocumentationVersionContext, useDocumentationVersion };
