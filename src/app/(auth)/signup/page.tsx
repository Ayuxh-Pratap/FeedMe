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

export default function SignupPage() {
  return (
    <AuthContentFrame>
      <section className="w-full">
        <AuthHeading
          title="Create your account"
          description="Set up your FeedMe login. Your profile and workspace come next."
        />

        <SocialAuthButtons />

        <div className="my-4">
          <AuthDivider label="or create account with email" />
        </div>

        <form className="space-y-5">
          <FeedMeField
            id="signup-email"
            label="Email"
            type="email"
            placeholder="your@workemail.com"
            autoComplete="email"
            required
          />
          <FeedMeField
            id="signup-password"
            label="Password"
            type="password"
            placeholder="********"
            autoComplete="new-password"
            required
          />
          <FeedMeField
            id="confirm-password"
            label="Confirm password"
            type="password"
            placeholder="********"
            autoComplete="new-password"
            required
          />

          <RouteTransitionButton href="/welcome" className="w-full">
            Create account
          </RouteTransitionButton>

          <p className="pt-3 text-center text-body-3 font-medium text-muted-foreground">
            Already have an account?{" "}
            <RouteTransitionLink
              href="/login"
              className="font-medium text-foreground hover:text-text-secondary"
            >
              Log in
            </RouteTransitionLink>
          </p>
        </form>
      </section>
    </AuthContentFrame>
  )
}
