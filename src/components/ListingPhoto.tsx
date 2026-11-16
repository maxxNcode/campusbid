import { useState } from 'react'

type ListingPhotoProps = {
  url: string | undefined
  title: string
  className?: string
}

// Shows a listing photo, or a plain text box when there is no photo or it
// fails to load.
export default function ListingPhoto({ url, title, className = '' }: ListingPhotoProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (!url || failedUrl === url) {
    return (
      <div className={`listing-photo listing-photo-missing ${className}`} role="img" aria-label={`No photo for ${title}`}>
        No photo available
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={`Photo of ${title}`}
      className={`listing-photo ${className}`}
      loading="lazy"
      onError={() => setFailedUrl(url)}
    />
  )
}
