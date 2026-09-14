import type { RecordedPackage } from "../../internal/build-manifest.js";
import type { DeploySettings, DeployTargetName, NodeRuntime, NoticeSection } from "../types.js";
import { dependencyNotices } from "./dependencies.js";
import { gtkxNotices } from "./gtkx.js";
import { libraryNotices } from "./libraries.js";
import { nodeNotices, sdkNodeNotices } from "./node-runtime.js";

type NoticeRequest = {
    settings: DeploySettings;
    node: NodeRuntime | null;
    shouldIncludeNode: boolean;
    packages: RecordedPackage[];
};

const collectNotices = ({
    settings,
    node,
    packages,
    shouldIncludeNode,
}: NoticeRequest): Record<DeployTargetName, NoticeSection[]> => {
    const common = [
        gtkxNotices(settings, packages),
        dependencyNotices(settings, packages),
        libraryNotices(settings),
    ].filter((section) => section.notices.length > 0);
    const bundled = shouldIncludeNode ? [nodeNotices(settings, node), ...common] : common;

    return {
        appimage: bundled,
        deb: bundled,
        flatpak: settings.deploy.flatpak?.mode === "source" ? [sdkNodeNotices(settings), ...common] : bundled,
        rpm: bundled,
    };
};

export { collectNotices };
