import { BrowserRouter, Route, Routes } from 'react-router'
import Layout from './components/Layout'
import NotFound from './components/NotFound'
import RequireAuth from './components/RequireAuth'
import { AuthProvider } from './context/AuthContext'
import HomePage from './pages/HomePage'
import BlogsPage from './pages/BlogsPage'
import BlogPage from './pages/BlogPage'
import PostPage from './pages/PostPage'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import EditorPage from './pages/EditorPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="blogs" element={<BlogsPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            {/* Public on purpose: the recovery link is what creates the session,
                so RequireAuth would bounce the arriving user to /login. */}
            <Route path="reset-password" element={<ResetPasswordPage />} />

            <Route element={<RequireAuth />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="new" element={<EditorPage />} />
              <Route path="edit/:id" element={<EditorPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* React Router ranks static segments above dynamic ones, so the
                routes above win over these `@handle` catch-alls. */}
            <Route path=":handle" element={<BlogPage />} />
            <Route path=":handle/:slug" element={<PostPage />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
