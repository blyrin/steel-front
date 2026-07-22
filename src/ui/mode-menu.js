export function createModeMenu({ container, definitions, onSelect }) {
  let selectedId = definitions[0].id

  function render() {
    container.replaceChildren(
      ...definitions.map(definition => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'mode-option'
        button.classList.toggle('selected', definition.id === selectedId)
        button.dataset.modeId = definition.id
        const name = document.createElement('strong')
        name.textContent = definition.name
        const detail = document.createElement('span')
        detail.textContent = definition.description
        button.append(name, detail)
        button.addEventListener('click', () => {
          selectedId = definition.id
          onSelect?.(selectedId)
          for (const option of container.children)
            option.classList.toggle('selected', option.dataset.modeId === selectedId)
        })
        return button
      })
    )
  }

  render()

  return {
    getSelectedModeId() {
      return selectedId
    },
  }
}
