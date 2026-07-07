import { createHash } from "node:crypto"

import { AppError } from "@/server/http/errors"

// Screenshots are uploaded straight from the extension to Cloudinary so the
// large base64 payloads never touch the API (Vercel's 4.5MB body limit) or the
// database. This module only holds the server-side signing secret; the cloud
// name and API key are safe to hand back to the client.
export type CloudinaryConfig = {
  cloudName: string
  apiKey: string
  apiSecret: string
  folder: string
}

const DEFAULT_UPLOAD_FOLDER = "feedme/reports"

class StorageConfigError extends AppError {
  constructor() {
    super({
      code: "STORAGE_NOT_CONFIGURED",
      message: "Image storage is not configured. Set the CLOUDINARY_* environment variables.",
      status: 500,
    })
    this.name = "StorageConfigError"
  }
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim()
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim()
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim()

  if (!cloudName || !apiKey || !apiSecret) {
    throw new StorageConfigError()
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    folder: process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || DEFAULT_UPLOAD_FOLDER,
  }
}

export function isAllowedCloudinaryImageUrl(value: string): boolean {
  let config: CloudinaryConfig
  let url: URL

  try {
    config = getCloudinaryConfig()
    url = new URL(value)
  } catch {
    return false
  }

  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") {
    return false
  }

  const segments = url.pathname.split("/").filter(Boolean)
  const [cloudName, resourceType, deliveryType, ...deliveryPath] = segments

  if (
    cloudName !== config.cloudName ||
    resourceType !== "image" ||
    deliveryType !== "upload"
  ) {
    return false
  }

  const folderSegments = config.folder.split("/").filter(Boolean)
  if (folderSegments.length === 0) {
    return false
  }

  const versionIndex = deliveryPath.findIndex((segment) => /^v\d+$/.test(segment))
  const publicPath =
    versionIndex >= 0 ? deliveryPath.slice(versionIndex + 1) : deliveryPath

  return startsWithSegments(publicPath, folderSegments)
}

function startsWithSegments(segments: string[], prefix: string[]) {
  return prefix.every((segment, index) => segments[index] === segment)
}

// Cloudinary signs the alphabetically-sorted `key=value` params joined by `&`,
// with the API secret appended, hashed with SHA-1. The client must send exactly
// these params (plus file + api_key) or the upload is rejected.
export function signCloudinaryParams(
  params: Record<string, string | number>,
  apiSecret: string
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&")

  return createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex")
}
