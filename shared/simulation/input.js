export const INPUT_ACTION = Object.freeze({
  JUMP: 1,
  RELOAD: 2,
  MELEE: 4,
  GRENADE: 8,
  ITEM: 16,
  SUPPLY: 32,
  SECONDARY: 64,
})

export function hasInputAction(actions, action) {
  return (actions & action) !== 0
}
