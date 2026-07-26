type RefreshTracker = {
    performRefresh: () => void;
    isRefreshing: () => boolean;
};

const createRefreshTracker = (performRefresh: () => void): RefreshTracker => {
    let refreshing = false;

    return {
        performRefresh: () => {
            refreshing = true;

            try {
                performRefresh();
            } finally {
                setTimeout(() => {
                    refreshing = false;
                }, 0);
            }
        },
        isRefreshing: () => refreshing,
    };
};

export { createRefreshTracker, type RefreshTracker };
