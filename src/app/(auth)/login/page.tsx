import Link from "next/link"

import {
  AuthContentFrame,
  AuthDivider,
  AuthHeading,
  FeedMeField,
  SocialAuthButtons,
} from "@/components/feedme/auth-ui"
import {
  RouteTransitionButton,
  RouteTransitionLink,
} from "@/components/feedme/experience/route-transition-button"

export default function LoginPage() {
  return (
    <AuthContentFrame>
      <section className="w-full">
        <AuthHeading title="Sign in to your account" />

        <SocialAuthButtons />

        <div className="my-4">
          <AuthDivider label="or log in with email" />
        </div>

        <form className="space-y-5">
          <FeedMeField
            id="email"
            label="Email"
            type="email"
            placeholder="your@workemail.com"
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-body-3 font-medium text-foreground">
                Password
              </label>
              <Link
                href="/login"
                className="text-body-3 text-muted-foreground hover:text-text-secondary"
              >
                Forgot password?
              </Link>
            </div>
            <FeedMeField id="password" type="password" placeholder="********" />
          </div>

          <RouteTransitionButton href="/welcome" className="w-full">
            Continue
          </RouteTransitionButton>

          <p className="pt-3 text-center text-body-3 font-medium text-muted-foreground">
            Don&apos;t have an account?{" "}
            <RouteTransitionLink
              href="/welcome"
              className="font-medium text-foreground hover:text-text-secondary"
            >
              Sign up
            </RouteTransitionLink>
          </p>
        </form>
      </section>
    </AuthContentFrame>
  )
}
