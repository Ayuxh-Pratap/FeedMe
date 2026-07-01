"use client"

/* eslint-disable @next/next/no-img-element -- Avatar URLs may come from arbitrary profile image storage; these are tiny identity images and should not require Next image host configuration yet. */

import Avvvatars from "avvvatars-react"

import { cn } from "@/lib/utils"

type FeedMeAvatarProps = {
  className?: string
  displayValue?: string
  fallbackStyle?: "character" | "shape"
  imageUrl?: string | null
  label: string
  size?: number
  value: string
}

function getDisplayValue(label: string, displayValue?: string) {
  const explicitValue = displayValue?.trim()

  if (explicitValue) {
    return explicitValue.slice(0, 2)
  }

  const normalizedLabel = label.includes("@") ? label.split("@")[0] : label
  const initials = normalizedLabel
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")

  return initials || "U"
}

export function FeedMeAvatar({
  className,
  displayValue,
  fallbackStyle = "shape",
  imageUrl,
  label,
  size = 32,
  value,
}: FeedMeAvatarProps) {
  const resolvedValue = value.trim() || label.trim() || "feedme-user"
  const resolvedImageUrl = imageUrl?.trim()

  return (
    <span
      aria-label={label}
      role="img"
      style={{ height: size, width: size }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-hairline bg-fill-subtle shadow-button-secondary",
        className
      )}
    >
      {resolvedImageUrl ? (
        <img
          alt=""
          className="size-full object-cover"
          src={resolvedImageUrl}
        />
      ) : (
        <Avvvatars
          value={resolvedValue}
          displayValue={getDisplayValue(label, displayValue)}
          size={size}
          radius={size}
          style={fallbackStyle}
          shadow={false}
        />
      )}
    </span>
  )
}
