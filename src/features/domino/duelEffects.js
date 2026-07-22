// Effect_Logic_Hook registry. The GDD's card schema doesn't include a
// monster "Type" (Warrior/Fiend/Dragon/...) field alongside Attribute, so
// any hook that would need one (Flame Swordsman's Fiend-matchup bonus) is
// left inert rather than silently guessing a type system that isn't
// modeled - same honest-fallback approach as the DDM ability/item work.
// IMPLEMENTED_HOOKS gates what actually has a working handler.

export const IMPLEMENTED_HOOKS = new Set([
  'Destroy_Single_SpellTrap', 'Destroy_Summoned_Monster_1000ATK_Min', 'Destroy_All_Monsters',
  'Revive_From_Graveyard', 'Lock_Opponent_Attacks', 'Redraw_Hand', 'Destroy_Lowest_ATK_Monster',
  'Draw_1', 'Reflect_Attack_Damage', 'Prevent_Battle_Damage_This_Turn', 'Destroy_All_Attack_Position',
  'Destroy_On_Flip',
])

export function isHookImplemented(hook) {
  return !!hook && IMPLEMENTED_HOOKS.has(hook)
}

// Which hooks need a target picked by the player (a spell/trap zone slot,
// a monster zone slot, etc.) vs resolving immediately with no target.
export function hookNeedsTarget(hook) {
  return hook === 'Destroy_Single_SpellTrap' || hook === 'Revive_From_Graveyard'
}
