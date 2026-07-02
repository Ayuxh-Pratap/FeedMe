/**
 * Updates the current URL's search params without triggering a Next.js
 * server round-trip (RSC refetch).
 *
 * The dashboard list views manage their own data client-side (filtering,
 * sorting, pagination, optimistic updates), so pushing filter/sort/scope/
 * selection state through `router.replace` would fire a wasteful server
 * re-render whose result is discarded. `window.history.replaceState`
 * integrates with Next's router — `usePathname`/`useSearchParams` still
 * update — but does not re-run server components.
 *
 * See node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md
 * ("Native History API").
 */
export function replaceUrlSearchParams(
  pathname: string,
  searchParams: URLSearchParams
) {
  if (typeof window === "undefined") {
    return
  }

  const query = searchParams.toString()

  window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname)
}
