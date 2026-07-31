import CorporateModal from '../finance/CorporateModal'

// Phone's Startups & M&A app. CorporateModal was fully functional
// (COMPANY_LISTINGS/buyCompany() in useGameStore.js/marketData.js) but had
// zero entry point anywhere in the game until this pass wired it in here,
// embedded (see that file's `embedded` prop).
export default function StartupsApp() {
  return (
    <div className="h-full overflow-y-auto">
      <CorporateModal embedded />
    </div>
  )
}
