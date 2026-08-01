type Props = {
  url: string | null | undefined
  name: string
  size?: number
}

export default function Avatar({ url, name, size = 32 }: Props) {
  const style = { width: size, height: size, fontSize: size * 0.45 }

  if (url) {
    return <img className="avatar" src={url} alt="" style={style} loading="lazy" />
  }

  return (
    <span className="avatar avatar-fallback" style={style} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
