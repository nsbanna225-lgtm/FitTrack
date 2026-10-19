import { lazy, Suspense } from 'react';
import PageBoundary from '../components/PageBoundary.jsx';
const NotificationsPage = lazy(() => import('../pages/NotificationsPage.jsx'));
const ProgressPage = lazy(() => import('../pages/ProgressPage.jsx'));
const MembershipPlansPage = lazy(() => import('../pages/MembershipPlansPage.jsx'));
const PaymentsPage = lazy(() => import('../pages/PaymentsPage.jsx'));
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage.jsx'));
const AttendancePage = lazy(() => import('../pages/AttendancePage.jsx'));
const SessionsPage = lazy(() => import('../pages/SessionsPage.jsx'));
const WorkoutsPage = lazy(() => import('../pages/WorkoutsPage.jsx'));
const WorkoutDetailPage = lazy(() => import('../pages/WorkoutDetailPage.jsx'));
const MembershipsPage = lazy(() => import('../pages/MembershipsPage.jsx'));
const MyMembershipPage = lazy(() => import('../pages/MyMembershipPage.jsx'));
const TrainerDetailPage = lazy(() => import('../pages/TrainerDetailPage.jsx'));
const MembersPage = lazy(() => import('../pages/MembersPage.jsx'));
const MemberDetailPage = lazy(() => import('../pages/MemberDetailPage.jsx'));
const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage.jsx'));
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute, { GuestRoute } from '../components/ProtectedRoute.jsx';
import AuthLayout from '../layouts/AuthLayout.jsx';
import AdminLayout from '../layouts/AdminLayout.jsx';
import TrainerLayout from '../layouts/TrainerLayout.jsx';
import MemberLayout from '../layouts/MemberLayout.jsx';
const WelcomePage = lazy(() => import('../pages/WelcomePage.jsx'));
const LoginPage = lazy(() => import('../pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('../pages/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage.jsx'));
const WorkspaceHomePage = lazy(() => import('../pages/WorkspaceHomePage.jsx'));
const ProfilePage = lazy(() => import('../pages/ProfilePage.jsx'));
const SecurityPage = lazy(() => import('../pages/SecurityPage.jsx'));
const ErrorPage = lazy(() => import('../pages/ErrorPage.jsx'));

export default function AppRoutes() {
  return <PageBoundary><Suspense fallback={<div className="loading-panel" role="status">Loading page…</div>}><Routes>
    <Route path="/" element={<WelcomePage />} />
    <Route element={<GuestRoute />}><Route element={<AuthLayout />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
    </Route></Route>
    {Object.entries({ admin: AdminLayout, trainer: TrainerLayout, member: MemberLayout }).map(([role, Layout]) =>
      <Route key={role} element={<ProtectedRoute role={role} />}>
        <Route path={`/${role}`} element={<Layout />}>
          <Route index element={role === 'admin' ? <AdminDashboardPage /> : <WorkspaceHomePage />} />
          {role === 'admin' && <Route path="members" element={<MembersPage key="member" />} />}
          {role === 'admin' && <Route path="analytics" element={<AnalyticsPage />} />}
          {role === 'admin' && <Route path="members/:id" element={<MemberDetailPage />} />}
          {role === 'admin' && <Route path="trainers" element={<MembersPage key="trainer" kind="trainer" />} />}
          {role === 'admin' && <Route path="trainers/:id" element={<TrainerDetailPage />} />}
          {role === 'admin' && <Route path="membership-plans" element={<MembershipPlansPage/>}/>}
          {role === 'admin' && <Route path="memberships" element={<MembershipsPage/>}/>}
          {role === 'member' && <Route path="membership" element={<MyMembershipPage/>}/>}
          <Route path="profile" element={<ProfilePage />} />
          {role !== 'trainer' && <Route path="attendance" element={<AttendancePage key="history" />} />}
          {role === 'admin' && <Route path="attendance/report" element={<AttendancePage key="report" report />} />}
          {role !== 'trainer' && <Route path="payments" element={<PaymentsPage />} />}
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="workouts" element={<WorkoutsPage key="assignments" />} />
          <Route path="workouts/assignments/:id" element={<WorkoutDetailPage />} />
          {role !== 'member' && <Route path="workouts/plans" element={<WorkoutsPage key="plans" kind="plans" />} />}
          {role !== 'member' && <Route path="workouts/exercises" element={<WorkoutsPage key="exercises" kind="exercises" />} />}
          <Route path="security" element={<SecurityPage />} />
        </Route>
      </Route>,
    )}
    <Route path="/forbidden" element={<ErrorPage forbidden />} />
    <Route path="*" element={<ErrorPage />} />
  </Routes></Suspense></PageBoundary>;
}

