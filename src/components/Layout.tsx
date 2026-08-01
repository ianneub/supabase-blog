import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../context/auth-context'
import { blogPath } from '../lib/slug'
import Avatar from './Avatar'

export default function Layout() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="shell">
      <header className="site-header">
        <Link to="/" className="brand">
          Supabase Blog
        </Link>

        <nav className="nav">
          <NavLink to="/">Latest</NavLink>
          <NavLink to="/blogs">Blogs</NavLink>

          {user ? (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <Link to="/new" className="btn btn-primary btn-sm">
                Write
              </Link>
              {profile && (
                <Link to={blogPath(profile.username)} className="nav-avatar" title="Your blog">
                  <Avatar
                    url={profile.avatar_url}
                    name={profile.display_name || profile.username}
                    size={28}
                  />
                </Link>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn btn-primary btn-sm">
              Sign in
            </NavLink>
          )}
        </nav>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <footer className="site-footer">
        <span>Built with React + Supabase · sign in with GitHub to start your own blog</span>
      </footer>
    </div>
  )
}
