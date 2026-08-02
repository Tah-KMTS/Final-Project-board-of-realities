/**
 * Money Laundering Engine: Cleans dirty narcotics/extortion cash through legitimate businesses.
 *
 * The old single-click "type an amount, pick one venue, click Launder" form
 * (launderDirtyCash()) has been replaced by the Route-the-Cash puzzle in
 * MoneyLaunderingModal.jsx, which builds a multi-hop route across these
 * venues and tracks a transparent, exact-numbers heat/audit-risk total per
 * route (see that file's heatFromHop/computeHeatLimit for the formulas).
 * heatPerFullFill is the new field that mechanic reads: how much heat a
 * single hop would add if it ran the venue at 100% of its dailyCapacity
 * (scaled down linearly for smaller amounts).
 */

export const LAUNDERING_VENUES = [
  { id: 'diner_kyoto', name: 'Cherry Coke Tea House & Diner (Kyoto)', dailyCapacity: 10000, feePercent: 0.10, heatPerFullFill: 45 },
  { id: 'speakeasy_osaka', name: 'Chicago Outfit Speakeasy Hotel (Osaka)', dailyCapacity: 50000, feePercent: 0.15, heatPerFullFill: 28 },
  { id: 'casino_flamingo', name: 'Flamingo Casino Resort (Osaka)', dailyCapacity: 150000, feePercent: 0.20, heatPerFullFill: 16 },
  { id: 'apple_store_tokyo', name: 'Apple Unibody Retail Store (Tokyo)', dailyCapacity: 250000, feePercent: 0.25, heatPerFullFill: 8 },
]
