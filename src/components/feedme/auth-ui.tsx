import type { ReactNode } from "react"
import { ArrowRight, Check, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type AuthContentFrameProps = {
  children: ReactNode
  className?: string
}

export function AuthContentFrame({ children, className }: AuthContentFrameProps) {
  return <div className={cn("w-full max-w-[430px]", className)}>{children}</div>
}

type AuthHeadingProps = {
  title: string
  description?: string
  className?: string
}

export function AuthHeading({ title, description, className }: AuthHeadingProps) {
  return (
    <header className={cn("mb-6 text-center", description && "mb-8", className)}>
      <h1 className="text-heading-3 text-foreground">{title}</h1>
      {description ? (
        <p className="mt-2 text-body-2 text-text-body">{description}</p>
      ) : null}
    </header>
  )
}

type AuthButtonProps = React.ComponentProps<typeof Button> & {
  tactile?: "primary" | "secondary"
}

export function AuthButton({
  className,
  tactile = "primary",
  children,
  variant,
  ...props
}: AuthButtonProps) {
  const resolvedVariant = variant ?? (tactile === "secondary" ? "secondary" : "default")

  return (
    <Button
      variant={resolvedVariant}
      className={cn(
        "relative isolate h-10 overflow-hidden rounded-lg text-heading-5 transition-all duration-base ease-out-soft",
        "active:scale-[var(--press-scale)] active:translate-y-0",
        tactile === "primary" &&
          [
            "border-primary-soft/60 [background:var(--gradient-primary-premium)] text-primary-foreground",
            "shadow-[var(--elevation-primary-premium)] [text-shadow:var(--text-shadow-button)]",
            "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:opacity-0 before:[background:var(--gradient-primary-premium-hover)]",
            "before:transition-opacity before:duration-base before:ease-out-soft hover:before:opacity-100",
            "after:pointer-events-none after:absolute after:right-[10%] after:top-px after:z-[1] after:h-px after:w-[60%] after:[background:var(--gradient-button-glint)]",
            "hover:shadow-[var(--elevation-primary-premium-hover)]",
          ],
        tactile === "secondary" &&
          [
            "[background:var(--gradient-secondary)] text-secondary-foreground shadow-button-secondary",
            "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:opacity-0 before:[background:var(--gradient-secondary-hover)]",
            "before:transition-opacity before:duration-base before:ease-out-soft hover:before:opacity-100",
            "hover:text-secondary-foreground hover:shadow-button-hover",
          ],
        className
      )}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </Button>
  )
}

type FeedMeFieldProps = {
  id: string
  label?: string
  type?: string
  placeholder?: string
  defaultValue?: string
  helper?: string
}

export function FeedMeField({
  id,
  label,
  type = "text",
  placeholder,
  defaultValue,
  helper,
}: FeedMeFieldProps) {
  return (
    <div className="space-y-2">
      {label ? (
        <Label htmlFor={id} className="text-body-3 font-medium text-foreground">
          {label}
        </Label>
      ) : null}
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={cn(
          "h-10 rounded-md border-border-hairline bg-input px-3 text-body-3 text-foreground",
          "placeholder:text-muted-foreground focus-visible:border-border-strong focus-visible:ring-0"
        )}
      />
      {helper ? <p className="text-body-3 text-muted-foreground">{helper}</p> : null}
    </div>
  )
}

type FeedMeUploadFieldProps = {
  children: ReactNode
  label: string
}

export function FeedMeUploadField({ children, label }: FeedMeUploadFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-body-3 font-medium text-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div
      className={cn(
        "relative flex h-9 items-center justify-center text-caption text-muted-foreground",
        // "before:absolute before:left-[-14px] before:top-1/2 before:size-7 before:-translate-y-1/2 before:rounded-full before:bg-background",
        // "after:absolute after:right-[-14px] after:top-1/2 after:size-7 after:-translate-y-1/2 after:rounded-full after:bg-background"
      )}
    >
      <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border-hairline" />
      <span className="relative px-2.5 text-body-3">{label}</span>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
      />
    </svg>
  )
}

export function SocialAuthButtons() {
  return (
    <div className="space-y-3">
      <AuthButton tactile="secondary" className="w-full gap-2">
        <GoogleMark />
        Continue with Google
      </AuthButton>
      {/* <AuthButton tactile="secondary" className="w-full gap-2">
        <KeyRound className="size-4 text-text-secondary" />
        Single Sign On
      </AuthButton> */}
    </div>
  )
}

export function UploadLogoControl() {
  return (
    <button
      type="button"
      className={cn(
        "flex h-14 w-full cursor-pointer items-center gap-3 rounded-lg border border-border-hairline bg-input px-4 text-left text-body-2 text-muted-foreground",
        "transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-text-secondary hover:shadow-button-secondary",
        "focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-0",
        "active:scale-[var(--press-scale)]"
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-fill-subtle text-muted-foreground shadow-button-secondary">
        <Upload className="size-4" />
      </span>
      Upload logo
    </button>
  )
}

type StepMarkerProps = {
  active: boolean
  complete?: boolean
  children: ReactNode
}

export function StepMarker({ active, complete, children }: StepMarkerProps) {
  return (
    <div
      className={cn(
        "flex size-8 items-center justify-center rounded-full border text-body-3 transition-all duration-base",
        active || complete
          ? "border-primary bg-primary text-primary-foreground shadow-button"
          : "border-border bg-surface-sunken text-muted-foreground"
      )}
    >
      {complete ? <Check className="size-4" /> : children}
    </div>
  )
}

export function ContinueIcon() {
  return <ArrowRight className="size-4" />
}
