import { AdwHeaderBar, AdwStatusPage, AdwToolbarView } from "@gtkx/jsx/adw";

const WelcomePage = () => (
    <AdwToolbarView topBar={<AdwHeaderBar showTitle={false} />}>
        <AdwStatusPage
            iconName="welcome-symbolic"
            title="Welcome to Adwaita Demo"
            description="This is a tour of the features the library has to offer"
        />
    </AdwToolbarView>
);

export { WelcomePage };
