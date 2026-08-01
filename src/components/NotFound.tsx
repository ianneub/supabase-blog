import { Link } from 'react-router-dom'

type Props = {
  title?: string
  message?: string
}

export default function NotFound({
  title = 'Page not found',
  message = 'That page does not exist.',
}: Props) {
  return (
    <div className="empty">
      <h1>{title}</h1>
      <p className="muted">{message}</p>
      <Link to="/" className="btn btn-ghost">
        Back home
      </Link>
    </div>
  )
}
