import type { DocumentationItem } from "./versioning.js";

const CONTRIBUTING_ROOT = "contributing/";

const contributingItems: DocumentationItem[] = [
    { text: "Overview", path: CONTRIBUTING_ROOT },
    { text: "Development Setup", path: "contributing/development" },
    { text: "Tech Stack", path: "contributing/tech-stack" },
    { text: "Architecture", path: "contributing/architecture" },
    { text: "Code Generation", path: "contributing/code-generation" },
    { text: "Native Runtime", path: "contributing/native-runtime" },
    { text: "React Renderer", path: "contributing/react-renderer" },
    { text: "Testing", path: "contributing/testing" },
    { text: "Development Principles", path: "contributing/principles" },
    { text: "Maintaining Documentation", path: "contributing/documentation" },
    { text: "Publishing Releases", path: "contributing/releases" },
];

export { CONTRIBUTING_ROOT, contributingItems };
