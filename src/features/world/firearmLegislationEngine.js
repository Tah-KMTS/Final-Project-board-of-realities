/**
 * Presidential Firearm Control Policy & Legal vs Black Market Firearm Engine.
 */

export function getPresidentialGunPolicy(president) {
  const presName = president?.name || 'Reagan'
  if (presName.includes('Reagan') || presName.includes('Washington') || presName.includes('Taft')) {
    return {
      category: 'PRO_GUN',
      title: '🇺🇸 Pro-Second Amendment Policy',
      legalOpen: true,
      requiresFfl: false,
      legalTax: 0,
      description: 'Firearms are 100% legal for all citizens without permits or federal tax.',
    }
  } else if (presName.includes('Roosevelt') || presName.includes('Obama') || presName.includes('Clinton')) {
    return {
      category: 'STRICT_CONTROL',
      title: '🚫 Strict Federal Gun Control Policy',
      legalOpen: false,
      requiresFfl: true,
      legalTax: 0.5,
      description: 'Concealed firearms & assault weapons BANNED from legal retail stores! FFL audit required.',
    }
  }
  return {
    category: 'MODERATE_REGULATION',
    title: '⚖️ Regulated Firearm Licensing Policy',
    legalOpen: true,
    requiresFfl: true,
    legalTax: 0.15,
    description: 'Legal gun sales require Federal Firearm License (FFL $5,000) and 15% state tax.',
  }
}

export function canPurchaseLegalFirearm(policy, hasFfl) {
  if (!policy.legalOpen) {
    return { allowed: false, reason: `Legal gun sales banned under ${policy.title}! Use Underground Black Market Dealer.` }
  }
  if (policy.requiresFfl && !hasFfl) {
    return { allowed: false, reason: `Requires Federal Firearm License (FFL)! Purchase FFL License for $5,000.` }
  }
  return { allowed: true }
}
