import * as THREE from 'three'

export function attachFlashlight(parent, position, targetPosition) {
  const light = new THREE.SpotLight(
    0xffe4b8,
    14,
    40,
    Math.PI / 6,
    0.62,
    1.1
  )
  light.position.copy(position)
  light.target.position.copy(targetPosition)
  parent.add(light)
  parent.add(light.target)
  return light
}
