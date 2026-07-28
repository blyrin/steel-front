export function createMapSystem({ ui }) {
  return {
    updateMinimap() {
      ui.invalidate()
    },
  }
}
