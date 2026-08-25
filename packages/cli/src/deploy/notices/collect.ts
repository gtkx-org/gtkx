import type { RecordedPackage } from "../../internal/build-manifest.js";
import type { DeploySettings, NodeRuntime, NoticeSection } from "../types.js";
import { dependencyNotices } from "./dependencies.js";
import { gtkxNotices } from "./gtkx.js";
import { libraryNotices } from "./libraries.js";
import { nodeNotices } from "./node-runtime.js";
import { bundledPackages } from "./packages.js";

type NoticeRequest = {
    settings: DeploySettings;
    node: NodeRuntime | null;
    packages: RecordedPackage[];
};

const collectNotices = ({ settings, node, packages: recordedPackages }: NoticeRequest): NoticeSection[] => {
    const packages = bundledPackages(settings, recordedPackages);

    const sections = [
        nodeNotices(settings, node),
        gtkxNotices(settings, packages),
        dependencyNotices(settings, packages),
        libraryNotices(settings),
    ];

    return sections.filter((section) => section.notices.length > 0);
};

export { collectNotices };
