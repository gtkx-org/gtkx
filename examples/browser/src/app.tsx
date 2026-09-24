import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/gi/gtk";
import * as WebKit from "@gtkx/gi/webkit";
import { AdwApplication, AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkEntry, GtkProgressBar } from "@gtkx/jsx/gtk";
import { WebKitWebView } from "@gtkx/jsx/webkit";
import { quit } from "@gtkx/react";
import { useCallback, useEffect, useState } from "react";

type BrowserState = {
    url: string;
    isLoading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
    progress: number;
};

type AppProps = {
    initialUrl?: string;
};

type NavigationButtonProps = {
    label: string;
    iconName: string;
    sensitive?: boolean;
    onClicked: () => void;
};

const START_URL = "https://gtkx.dev";
const BACK_LABEL = "Go back";
const FORWARD_LABEL = "Go forward";

const urlBarStyle = css`
    min-width: 400px;
`;

const normalizeUrl = (targetUrl: string): string => {
    const trimmed = targetUrl.trim();
    const url = URL.parse(trimmed);

    if (url && !/^localhost:\d+(?:[/?#]|$)/iu.test(trimmed)) {
        return url.href;
    }

    return URL.parse(`https://${trimmed}`)?.href ?? `https://${trimmed}`;
};

const navigateTo = (webView: WebKit.WebView | null, targetUrl: string) => {
    webView?.loadUri(normalizeUrl(targetUrl));
};

const loadActionLabel = (isLoading: boolean): string => isLoading ? "Stop loading" : "Reload";

const NavigationButton = ({ label, iconName, sensitive, onClicked }: NavigationButtonProps) => (
    <GtkButton
        iconName={iconName}
        onClicked={onClicked}
        sensitive={sensitive}
        accessibleLabel={label}
        tooltipText={label}
    />
);

const useBrowserController = (webView: WebKit.WebView | null, initialUrl: string) => {
    const [state, setState] = useState<BrowserState>({
        url: initialUrl,
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
        progress: 0,
    });

    useEffect(() => {
        const url = normalizeUrl(initialUrl);

        if (webView && webView.getUri() !== url) {
            webView.loadUri(url);
        }
    }, [webView, initialUrl]);

    const setUrl = (url: string) => {
        setState((s) => ({ ...s, url }));
    };

    const navigate = (targetUrl: string) => {
        navigateTo(webView, targetUrl);
    };

    const handleUri = (url: string | null, webView: WebKit.WebView) => {
        setState((s) => ({
            ...s,
            url: url ?? s.url,
            canGoBack: webView.canGoBack(),
            canGoForward: webView.canGoForward(),
        }));
    };

    const handleIsLoading = (isLoading: boolean | null, webView: WebKit.WebView) => {
        setState((s) => ({
            ...s,
            isLoading: isLoading ?? false,
            progress: isLoading ? 0 : 1,
            canGoBack: webView.canGoBack(),
            canGoForward: webView.canGoForward(),
        }));
    };

    const handleEstimatedLoadProgress = (progress: number | null) => {
        setState((s) => ({ ...s, progress: progress ?? s.progress }));
    };

    return { state, setUrl, navigate, handleUri, handleIsLoading, handleEstimatedLoadProgress };
};

const UrlEntry = ({
    url,
    onUrlChanged,
    onActivate,
}: {
    url: string;
    onUrlChanged: (value: string) => void;
    onActivate: () => void;
}) => (
    <GtkEntry
        text={url}
        onChanged={(entry: Gtk.Entry) => {
            onUrlChanged(entry.getText());
        }}
        onActivate={onActivate}
        hexpand
        cssClasses={[urlBarStyle]}
        accessibleLabel="Web address"
        placeholderText="Enter URL..."
    />
);

const NavigationButtons = ({
    canGoBack,
    canGoForward,
    isLoading,
    onBack,
    onForward,
    onReloadOrStop,
}: {
    canGoBack: boolean;
    canGoForward: boolean;
    isLoading: boolean;
    onBack: () => void;
    onForward: () => void;
    onReloadOrStop: () => void;
}) => (
    <>
        <NavigationButton
            iconName="go-previous-symbolic"
            onClicked={onBack}
            sensitive={canGoBack}
            label={BACK_LABEL}
        />
        <NavigationButton
            iconName="go-next-symbolic"
            onClicked={onForward}
            sensitive={canGoForward}
            label={FORWARD_LABEL}
        />
        <NavigationButton
            iconName={isLoading ? "process-stop-symbolic" : "view-refresh-symbolic"}
            onClicked={onReloadOrStop}
            label={loadActionLabel(isLoading)}
        />
    </>
);

const LoadingProgress = ({ isLoading, progress }: { isLoading: boolean; progress: number }) => (
    <GtkProgressBar
        fraction={progress}
        visible={isLoading}
        accessibleLabel="Page loading progress"
    />
);

const useWebView = () => {
    const [webView, setWebView] = useState<WebKit.WebView | null>(null);
    const assignWebView = useCallback((instance: WebKit.WebView | null) => {
        setWebView(instance);

        return instance
            ? () => {
                    instance.stopLoading();
                }
            : undefined;
    }, []);

    return { webView, assignWebView };
};

const BrowserWindow = ({ initialUrl }: { initialUrl: string }) => {
    const { webView, assignWebView } = useWebView();
    const { state, setUrl, navigate, handleUri, handleIsLoading, handleEstimatedLoadProgress } =
        useBrowserController(webView, initialUrl);

    const { url, isLoading, canGoBack, canGoForward, progress } = state;

    return (
        <AdwApplicationWindow title="GTKX Browser" defaultWidth={1024} defaultHeight={768} onCloseRequest={quit}>
            <AdwToolbarView
                topBar={(
                    <AdwHeaderBar
                        titleWidget={(
                            <UrlEntry
                                url={url}
                                onUrlChanged={setUrl}
                                onActivate={() => {
                                    navigate(url);
                                }}
                            />
                        )}
                        start={(
                            <NavigationButtons
                                canGoBack={canGoBack}
                                canGoForward={canGoForward}
                                isLoading={isLoading}
                                onBack={() => webView?.goBack()}
                                onForward={() => webView?.goForward()}
                                onReloadOrStop={() => isLoading ? webView?.stopLoading() : webView?.reload()}
                            />
                        )}
                    />
                )}
            >
                <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
                    <LoadingProgress isLoading={isLoading} progress={progress} />
                    <WebKitWebView
                        ref={assignWebView}
                        accessibleLabel="Web page"
                        vexpand
                        hexpand
                        onNotifyUri={handleUri}
                        onNotifyIsLoading={handleIsLoading}
                        onNotifyEstimatedLoadProgress={handleEstimatedLoadProgress}
                    />
                </GtkBox>
            </AdwToolbarView>
        </AdwApplicationWindow>
    );
};

const App = ({ initialUrl = START_URL }: AppProps) => (
    <AdwApplication>
        <BrowserWindow initialUrl={initialUrl} />
    </AdwApplication>
);

export { App };
