# WHERE7 Phase 6 — Plus, Cosmetics, Partnerships & Growth

## Features implemented
- `/plus`: dedicated responsive presentation of WHERE7 Plus, premium and free cosmetic themes, account frames, and links to practice, rewards and social modes.
- `/api/plus`: signed-in cosmetics storage with server-side entitlements; premium selections are rejected without an active or trialing subscription. Existing game scores, XP, hearts and league rankings remain unaffected.
- Configurable Stripe Checkout (`/api/plus/checkout`) and verified webhook (`/api/plus/webhook`); checkout is disabled until a server secret, recurring price ID, and webhook secret are set. Redirecting to a success URL alone never grants access.
- `/admin/partners`: admin-only creation, activation and deletion of clearly labelled sponsored journeys. Campaign links are restricted to public HTTPS destinations and sponsorships only appear outside ranked play.
- `/admin/growth`: private aggregate analytics for completed daily games and player accounts; the public never sees identifying records.
- PWA installation metadata, icon, offline fallback and service worker. Sensitive API responses are never cached.
- Optional calendar reminder export for daily play; user controls reminders in their calendar app.
- Sitemap, robots rules and new desktop/mobile links to themes and Plus.

## Deployment and configuration
No payments are enabled by this release by itself. For live billing, an operator must:
1. Create and verify the business Stripe account and tax/legal/consumer information as applicable.
2. Create a Stripe recurring Price and configure **only server-side** Vercel environment variables `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`. Never expose secrets as `NEXT_PUBLIC_...`.
3. Configure a Stripe webhook destination at `https://www.where7.world/api/plus/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Test a full subscription, renewal, cancellation, a failed payment and out-of-order events in Stripe test mode, and verify the database entitlements and cosmetics locking. Complete these steps before allowing real customers to pay.
5. Add visible legal terms, privacy/cookie details, applicable price/tax disclosure, account cancellation/customer portal and a support contact before commercial launch.

The app deliberately reports Checkout as unavailable when the environment is not complete. **Billing has not been activated or end-to-end payment-tested.**

## Privacy and limits
The existing `player_entitlements`, `player_cosmetics`, and `sponsored_journeys` Supabase tables have RLS enabled and service-role-only grants; browsers cannot edit them directly. Writes require verified Supabase auth, with admin-only campaign actions. Payment webhooks verify the signed raw payload within a timestamp tolerance window.

Calendar reminders use an ICS download rather than intrusive push notification permissions. The service worker only caches a non-sensitive offline landing screen. Sponsor links are labelled and do not influence answers, map clues or rankings.

## Release verification
Run `npm ci && npm test && npm run typecheck && npm run build`. For every release, confirm the Vercel preview is Ready, the production deployment is Ready, and GitHub Actions completes successfully.

Automated testing cannot certify the entire user journey. Manual checks are still advised on iPhone/Safari and desktop Chrome for PWA installation, calendar import, keyboard controls and cosmetic persistence.

## Scope boundary
This release builds a safe, configurable commercial foundation. It does **not** automatically register a Stripe account, determine subscription pricing, enable third-party ad tracking, solicit live payments, or assume legal compliance.
