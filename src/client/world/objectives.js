import * as THREE from 'three'

export function createObjectiveSystem({ scene, matLib }) {
  function addMesh(group, geometry, material, x, y, z, castShadow = true) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.castShadow = castShadow
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  function createSupplyStation(group, { x, z, deckHeight, kind }) {
    const station = new THREE.Group()
    station.position.set(x, deckHeight, z)
    const isMedical = kind === 'medical'
    const accent = (isMedical ? matLib.axisAccent : matLib.allyAccent).clone()
    accent.color.set(isMedical ? 0xe35b62 : 0xffd447)
    accent.emissive.set(isMedical ? 0x65151d : 0x6b4d0e)
    accent.emissiveIntensity = 1.6

    addMesh(station, new THREE.BoxGeometry(2.2, 0.14, 1.35), matLib.metalDark, 0, 0.07, 0)
    addMesh(
      station,
      new THREE.BoxGeometry(1.05, 0.72, 0.86),
      isMedical ? matLib.rust : matLib.metal,
      0,
      0.5,
      0
    )
    addMesh(station, new THREE.BoxGeometry(1.12, 0.08, 0.92), accent, 0, 0.88, 0)

    if (isMedical) {
      const panel = addMesh(
        station,
        new THREE.BoxGeometry(0.72, 0.72, 0.08),
        matLib.metalDark,
        0,
        1.25,
        -0.47
      )
      panel.castShadow = false
      addMesh(station, new THREE.BoxGeometry(0.42, 0.1, 0.05), accent, 0, 1.25, -0.52)
      addMesh(station, new THREE.BoxGeometry(0.1, 0.42, 0.05), accent, 0, 1.25, -0.52)
    } else {
      addMesh(station, new THREE.BoxGeometry(0.55, 0.55, 0.06), accent, 0, 1.2, -0.47)
      for (const offset of [-0.12, 0, 0.12])
        addMesh(
          station,
          new THREE.CylinderGeometry(0.035, 0.035, 0.28, 6),
          matLib.brass,
          offset,
          1.2,
          -0.52
        ).rotation.x = Math.PI / 2
    }

    group.add(station)
    matLib.addOutline(station, 1.03)
  }

  function createFortress({
    x,
    z,
    maxHealth,
    radius,
    attackRadius,
    bottomRadius,
    topRadius,
    deckHeight,
  }) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)

    const fortressMetal = matLib.metal.clone()
    fortressMetal.color.set(0x65747d)
    const fortressDeckMetal = fortressMetal.clone()
    fortressDeckMetal.color.set(0x3d5059)

    addMesh(
      group,
      new THREE.CylinderGeometry(topRadius, bottomRadius, deckHeight, 48, 4, false),
      fortressMetal,
      0,
      deckHeight * 0.5,
      0
    )
    const topSurface = addMesh(
      group,
      new THREE.CircleGeometry(topRadius * 0.96, 48),
      fortressDeckMetal,
      0,
      deckHeight + 0.035,
      0,
      false
    )
    topSurface.rotation.x = -Math.PI / 2
    createSupplyStation(group, { x: -3.2, z: 0, deckHeight, kind: 'medical' })
    createSupplyStation(group, { x: 3.2, z: 0, deckHeight, kind: 'ammo' })

    scene.add(group)
    matLib.addOutline(group, 1.025)
    return group
  }

  return { createFortress }
}
