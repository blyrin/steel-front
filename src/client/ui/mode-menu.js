export function createModeMenu({ ui, definitions, onSelect }) {
  let selectedId = definitions[0].id
  ui.setModes(definitions, selectedId)

  return {
    select(id) {
      selectedId = id
      ui.setSelectedMode(id)
      onSelect?.(id)
    },
    getSelectedModeId() {
      return selectedId
    },
  }
}
