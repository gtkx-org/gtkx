type RefreshTracker = {
    performRefresh: () => number;
    isRefreshing: () => boolean;
};

const createRefreshTracker = (performRefresh: () => number): RefreshTracker => {
    let isRefreshing = false;

    return {
        performRefresh: () => {
            isRefreshing = true;

            try {
                return performRefresh();
            } finally {
                setTimeout(() => {
                    isRefreshing = false;
                }, 0);
            }
        },
        isRefreshing: () => isRefreshing,
    };
};

export { createRefreshTracker, type RefreshTracker };
