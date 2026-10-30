import { lazy } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import type { ParentProps } from 'solid-js';
import Layout from '~/components/layout/Layout';
import RequireAuth from '~/components/auth/RequireAuth';
import { i18nStore } from '~/i18n';
const Setup = lazy(() => import('~/pages/Setup'));
const Login = lazy(() => import('~/pages/Login'));
const Dashboard = lazy(() => import('~/pages/Dashboard'));
const MediaList = lazy(() => import('~/pages/MediaList'));
const MediaEdit = lazy(() => import('~/pages/MediaEdit'));
const CategoryList = lazy(() => import('~/pages/CategoryList'));
const CategoryEdit = lazy(() => import('~/pages/CategoryEdit'));
const ProductList = lazy(() => import('~/pages/ProductList'));
const ProductEdit = lazy(() => import('~/pages/ProductEdit'));
const Settings = lazy(() => import('~/pages/Settings'));
const InstanceSettings = lazy(() => import('~/pages/InstanceSettings'));
const BackupSettings = lazy(() => import('~/pages/BackupSettings'));
const OidcSettings = lazy(() => import('~/pages/OidcSettings'));
const SmtpSettings = lazy(() => import('~/pages/SmtpSettings'));
const SecuritySettingsPage = lazy(() => import('~/pages/SecuritySettingsPage'));
const UserManagement = lazy(() => import('~/pages/UserManagement'));
const TenantList = lazy(() => import('~/pages/TenantList'));
const TenantSettings = lazy(() => import('~/pages/TenantSettings'));
const ApiDocs = lazy(() => import('~/pages/ApiDocs'));
const Activities = lazy(() => import('~/pages/Activities'));
const Profile = lazy(() => import('~/pages/Profile'));
const ApiKeys = lazy(() => import('~/pages/ApiKeys'));
const Stats = lazy(() => import('~/pages/Stats'));
const TenantStats = lazy(() => import('~/pages/TenantStats'));
const SuperuserManagement = lazy(() => import('~/pages/SuperuserManagement'));
const SuperuserLogin = lazy(() => import('~/pages/SuperuserLogin'));
const About = lazy(() => import('~/pages/About'));

// Everything inside the app shell requires a verified session.
const ProtectedLayout = (props: ParentProps) => (
    <RequireAuth>
        <Layout>{props.children}</Layout>
    </RequireAuth>
);

export default function App() {
    return (
        <Router>
            <Route path="/setup" component={Setup} />
            <Route path="/login" component={Login} />
            <Route path="/superlogin" component={SuperuserLogin} />
            <Route path="/" component={ProtectedLayout}>
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
                <Route path="/settings/general" component={InstanceSettings} />
                <Route path="/settings/backup" component={BackupSettings} />
                <Route path="/settings/oidc" component={OidcSettings} />
                <Route path="/settings/smtp" component={SmtpSettings} />
                <Route path="/settings/security" component={SecuritySettingsPage} />
                <Route path="/users" component={UserManagement} />
                <Route path="/tenants" component={TenantList} />
                <Route path="/tenants/new" component={TenantSettings} />
                <Route path="/tenants/:id" component={TenantSettings} />
                <Route path="/tenants/:id/stats" component={TenantStats} />
                <Route path="/stats" component={Stats} />
                <Route path="/superusers" component={SuperuserManagement} />
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
                        <div class="text-gray-900 dark:text-white text-2xl">{i18nStore.t('notFound.title')}</div>
                    </div>
                )}
            />
        </Router>
    );
}
