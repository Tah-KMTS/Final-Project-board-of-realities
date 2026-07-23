export const TREASURY_SECRETARIES = [
  { id: 'hamilton', name: 'Alexander Hamilton', title: '1st Secretary of the Treasury (System Architect)' },
  { id: 'gallatin', name: 'Albert Gallatin', title: 'Longest-Serving Treasury Secretary' },
  { id: 'mellon', name: 'Andrew Mellon', title: '1920s Industrial Boom Treasury Chief' },
  { id: 'morgenthau', name: 'Henry Morgenthau Jr.', title: 'New Deal & WWII Treasury Chief' },
  { id: 'rubin', name: 'Robert Rubin', title: '1990s Tech Expansion Treasury Secretary' },
]

export function initializeTreasuryState() {
  return {
    bondRate: 4.5, // 4.5% annual Treasury yield
    playerBonds: 0,
    treasuryLogs: [
      { id: 'treasury_init', text: 'US Treasury Department active. 10-Year Treasury Bonds issuing 4.5% yield.' }
    ],
  }
}

export function buyTreasuryBonds(treasuryState, amount, playerCash) {
  if (playerCash < amount) {
    return { success: false, reason: `Insufficient cash! Need $${amount.toLocaleString()}.` }
  }
  return {
    success: true,
    amountBought: amount,
    updatedTreasuryState: {
      ...treasuryState,
      playerBonds: (treasuryState.playerBonds || 0) + amount,
      treasuryLogs: [
        { id: `bond_${Date.now()}`, text: `Purchased $${amount.toLocaleString()} in US 10-Year Treasury Bonds at ${treasuryState.bondRate}% yield.` },
        ...(treasuryState.treasuryLogs || []),
      ].slice(0, 15),
    },
  }
}
