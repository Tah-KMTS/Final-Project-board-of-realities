/**
 * Autonomous Agent Capital Accumulation & Asset Purchasing Engine.
 */

export function simulateAgentAssetPurchasing(agents, day) {
  const assetLogs = []

  const updatedAgents = agents.map((agent) => {
    const copy = { ...agent }
    // Accumulate capital from daily yield
    const yieldAmount = copy.category?.includes('Crime') ? 15000 : 25000
    copy.netWorth = (copy.netWorth || 1000000) + yieldAmount

    // Autonomous Asset Purchase Trigger
    if (Math.random() < 0.1) {
      const assetTypes = ['Commercial Land Plot', 'Tech Patent Rights', 'Suburban Real Estate Estate', 'Corporate Bond Portfolio', 'Luxury Penthouse']
      const purchasedAsset = assetTypes[Math.floor(Math.random() * assetTypes.length)]
      assetLogs.push({
        id: `asset_buy_${day}_${copy.id}`,
        day,
        text: `💰 ${copy.name} acquired a new ${purchasedAsset} in ${copy.currentCity || 'Tokyo'}!`,
      })
    }

    return copy
  })

  return {
    updatedAgents,
    assetLogs,
  }
}
