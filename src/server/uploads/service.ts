import { getCloudinaryConfig, signCloudinaryParams } from "@/server/uploads/cloudinary"

export type CloudinaryUploadSignature = {
  cloudName: string
  apiKey: string
  timestamp: number
  folder: string
  signature: string
}

// Returns a short-lived signed payload the extension uses to upload screenshots
// directly to Cloudinary. The caller must already be an authenticated session;
// report submission still re-validates workspace membership and domain, so a
// leaked signature only lets a signed-in user push images into the folder.
export function createReportUploadSignature(): CloudinaryUploadSignature {
  const config = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = signCloudinaryParams(
    { folder: config.folder, timestamp },
    config.apiSecret
  )

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    folder: config.folder,
    signature,
  }
}
