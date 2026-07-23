/**
 * Money Laundering Engine: Cleans dirty narcotics/extortion cash through legitimate businesses.
 */

export const LAUNDERING_VENUES = [
  { id: 'diner_kyoto', name: 'Cherry Coke Tea House & Diner (Kyoto)', dailyCapacity: 10000, feePercent: 0.10 },
  { id: 'speakeasy_osaka', name: 'Chicago Outfit Speakeasy Hotel (Osaka)', dailyCapacity: 50000, feePercent: 0.15 },
  { id: 'casino_flamingo', name: 'Flamingo Casino Resort (Osaka)', dailyCapacity: 150000, feePercent: 0.20 },
  { id: 'apple_store_tokyo', name: 'Apple Unibody Retail Store (Tokyo)', dailyCapacity: 250000, feePercent: 0.25 },
]

export function launderDirtyCash(dirtyAmount, venueId) {
  const venue = LAUNDERING_VENUES.find((v) => v.id === venueId) || LAUNDERING_VENUES[0]
  const amountToLaunder = Math.min(dirtyAmount, venue.dailyCapacity)
  const fee = amountToLaunder * venue.feePercent
  const cleanCash = amountToLaunder - fee

  return {
    venue,
    amountLaundered: amountToLaunder,
    fee,
    cleanCash,
    log: `💵 MONEY LAUNDERING: Laundered $${amountToLaunder.toLocaleString()} dirty cash through ${venue.name}! Clean cash: +$${cleanCash.toLocaleString()} (Fee: $${fee.toLocaleString()}).`,
  }
}
