import { Router, Route } from '@solidjs/router';
import Layout from '~/components/layout/Layout';
import Setup from '~/pages/Setup';
import Login from '~/pages/Login';
import Dashboard from '~/pages/Dashboard';
import MediaList from '~/pages/MediaList';
import MediaEdit from '~/pages/MediaEdit';
import CategoryList from '~/pages/CategoryList';
import CategoryEdit from '~/pages/CategoryEdit';
import ProductList from '~/pages/ProductList';
import ProductEdit from '~/pages/ProductEdit';
import Settings from '~/pages/Settings';
import InstanceSettings from '~/pages/InstanceSettings';
import OidcSettings from '~/pages/OidcSettings';
import UserManagement from '~/pages/UserManagement';
import TenantList from '~/pages/TenantList';
import TenantSettings from '~/pages/TenantSettings';
import ApiDocs from '~/pages/ApiDocs';
import Activities from '~/pages/Activities';
import Profile from '~/pages/Profile';
import ApiKeys from '~/pages/ApiKeys';
import Stats from '~/pages/Stats';
import TenantStats from '~/pages/TenantStats';
import About from '~/pages/About';

export default function App() {
    return (
        <Router>
            <Route path="/setup" component={Setup} />
            <Route path="/login" component={Login} />
            <Route path="/" component={Layout}>
                <Route path="/" component={Dashboard} />
                <Route path="/media/new" component={MediaEdit} />
                <Route path="/media/:id" component={MediaEdit} />
                <Route path="/media" component={MediaList} />
                <Route path="/categories" component={CategoryList} />
                <Route path="/categories/new" component={CategoryEdit} />
                <Route path="/categories/:id" component={CategoryEdit} />
                <Route path="/products/new" component={ProductEdit} />
                <Route path="/products/:id" component={ProductEdit} />
                <Route path="/products" component={ProductList} />
                <Route path="/settings" component={Settings} />
                <Route path="/settings/instance" component={InstanceSettings} />
                <Route path="/settings/oidc" component={OidcSettings} />
                <Route path="/users" component={UserManagement} />
                <Route path="/tenants" component={TenantList} />
                <Route path="/tenants/new" component={TenantSettings} />
                <Route path="/tenants/:id" component={TenantSettings} />
                <Route path="/tenants/:id/stats" component={TenantStats} />
                <Route path="/stats" component={Stats} />
                <Route path="/api-docs" component={ApiDocs} />
                <Route path="/activities" component={Activities} />
                <Route path="/profile" component={Profile} />
                <Route path="/api-keys" component={ApiKeys} />
                <Route path="/about" component={About} />
            </Route>
            <Route
                path="*"
                component={() => (
                    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                        <div class="text-gray-900 dark:text-white text-2xl">404 — Page not found</div>
                    </div>
                )}
            />
        </Router>
    );
}
