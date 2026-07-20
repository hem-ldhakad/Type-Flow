// src/router/index.jsx
//
// ── Component Hierarchy (full tree) ──────────────────────────────────────────
//
//  <RouterProvider router={router}>
//    <GlobalLayout>                      ← always rendered (navbar + footer)
//      │
//      ├── /                             → <HomePage />
//      │
//      ├── /login                        → <GuestRoute>
//      │                                     └─ <LoginPage />
//      │
//      ├── /register                     → <GuestRoute>
//      │                                     └─ <RegisterPage />
//      │
//      ├── /dashboard                    → <ProtectedRoute>
//      │                                     └─ <DashboardPage />
//      │
//      ├── /race/:roomId                 → <ProtectedRoute>
//      │                                     └─ <RacePage />
//      │
//      ├── /profile/:userId              → <ProtectedRoute>
//      │                                     └─ <ProfilePage />
//      │
//      └── *                             → <NotFoundPage />
//
// GuestRoute   → if authenticated,  redirect to /dashboard (or prior `from`)
// ProtectedRoute → if unauthenticated, redirect to /login (saves `from`)
//
import { createBrowserRouter } from 'react-router-dom';
import GlobalLayout from '../layouts/GlobalLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import GuestRoute from '../components/GuestRoute';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import DashboardPage from '../pages/DashboardPage';
import RacePage from '../pages/RacePage';
import SoloPracticePage from '../pages/SoloPracticePage';
import ProfilePage from '../pages/ProfilePage';
import LeaderboardPage from '../pages/LeaderboardPage';
import NotFoundPage from '../pages/NotFoundPage';

const router = createBrowserRouter([
    {
        path: '/',
        element: <GlobalLayout />,
        children: [
            // Public
            { index: true, element: <HomePage /> },
            { path: 'leaderboard', element: <LeaderboardPage /> },
            { path: '*', element: <NotFoundPage /> },

            // Guest-only (redirect away if already logged in)
            {
                path: 'login',
                element: (
                    <GuestRoute>
                        <LoginPage />
                    </GuestRoute>
                ),
            },
            {
                path: 'register',
                element: (
                    <GuestRoute>
                        <RegisterPage />
                    </GuestRoute>
                ),
            },

            // Protected (redirect to /login if not authenticated)
            {
                path: 'dashboard',
                element: (
                    <ProtectedRoute>
                        <DashboardPage />
                    </ProtectedRoute>
                ),
            },
            {
                path: 'race/solo',
                element: (
                    <ProtectedRoute>
                        <SoloPracticePage />
                    </ProtectedRoute>
                ),
            },
            {
                path: 'race/:roomId',
                element: (
                    <ProtectedRoute>
                        <RacePage />
                    </ProtectedRoute>
                ),
            },
            {
                path: 'profile/:userId',
                element: (
                    <ProtectedRoute>
                        <ProfilePage />
                    </ProtectedRoute>
                ),
            },
        ],
    },
]);

export default router;
