// Client-safe helpers for deriving Cloudinary delivery transforms from a stored
// secure_url. These are pure string builders — no SDK, no secrets — so both the
// server read model and client components can reuse them.

const CLOUDINARY_DELIVERY = /res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload\//i
const UPLOAD_MARKER = "/upload/"

// Grid cards and the right-rail evidence frame only need a light thumbnail.
// f_auto picks WebP/AVIF, q_auto trims bytes, c_limit avoids upscaling.
const THUMBNAIL_TRANSFORM = "c_limit,w_720,f_auto,q_auto"

function insertCloudinaryTransform(url: string, transform: string): string {
  if (!url || !CLOUDINARY_DELIVERY.test(url)) {
    return url
  }

  const markerIndex = url.indexOf(UPLOAD_MARKER)
  if (markerIndex === -1) {
    return url
  }

  const insertAt = markerIndex + UPLOAD_MARKER.length
  const rest = url.slice(insertAt)

  // Don't stack a second transform if this URL already carries one.
  if (rest.startsWith(`${transform}/`)) {
    return url
  }

  return `${url.slice(0, insertAt)}${transform}/${rest}`
}

export function buildCloudinaryThumbnailUrl(url: string | undefined | null): string | undefined {
  if (!url) {
    return undefined
  }

  return insertCloudinaryTransform(url, THUMBNAIL_TRANSFORM)
}
