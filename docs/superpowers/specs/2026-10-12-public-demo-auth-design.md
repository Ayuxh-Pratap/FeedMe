# Public Demo Authentication Design

## Goal

Let visitors create and enter accounts without email delivery while preserving FeedMe's production email-verification implementation for future deployments.

## Configuration

`AUTH_MODE` accepts `demo` or `verified`. A missing value resolves to `demo` for this public portfolio deployment. Any other value fails configuration validation instead of silently weakening authentication.

`DEMO_ACCOUNT_EMAIL` and `DEMO_ACCOUNT_PASSWORD` configure the shared account shown by the login form. Their defaults are intentionally public because loading them into a browser makes them public by definition.

## Demo Flow

- Signup still validates email format and the shared password policy.
- A new user is stored with `emailVerifiedAt` set immediately.
- Signup creates a session and sends the visitor directly to the validated destination or welcome onboarding.
- Login accepts existing accounts whose email was never verified.
- Duplicate signup does not overwrite a password and returns a conflict directing the visitor to login.
- Password recovery and verification UI are not promoted in demo mode because email delivery is not part of that deployment.

## Verified Flow

The existing durable verification-token and auth-email-outbox flow remains unchanged behind `AUTH_MODE=verified`. Signup does not create a session in this mode; verification creates the first session.

## Interface

Login and signup expose a compact information icon explaining that the hosted instance is a public demo. Login includes a secondary action that fills the configured shared credentials but leaves submission under the visitor's control.

## Verification

Regression coverage must prove the default mode, explicit verified mode, invalid configuration handling, default demo credentials, preservation of the verified signup transaction, demo signup session creation, and login's mode-aware verification gate.
