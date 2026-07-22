import * as THREE from 'three'

export function createObjectiveSystem({ scene, matLib, state }) {
  function addFrustumObstacle({ type, x, z, bottomRadius, topRadius, height }) {
    state.obstacles.push({
      type,
      shape: 'frustum',
      x,
      z,
      h: height,
      minY: 0,
      maxY: height,
      bottomRadius,
      topRadius,
    })
  }

  function addBoxObstacle({ type, x, z, width, depth, height, minY }) {
    state.obstacles.push({
      type,
      shape: 'box',
      x,
      z,
      w: width,
      d: depth,
      h: height,
      minY,
      maxY: minY + height,
      rot: 0,
      cos: 1,
      sin: 0,
      hw: width * 0.5,
      hd: depth * 0.5,
      r: Math.sqrt(width * width + depth * depth) * 0.5,
    })
  }

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
    const worldX = group.position.x + x
    const worldZ = group.position.z + z
    addBoxObstacle({
      type: `${kind}-station`,
      x: worldX,
      z: worldZ,
      width: 2.2,
      depth: 1.35,
      height: 1.35,
      minY: deckHeight,
    })
    const stationData = {
      position: new THREE.Vector3(worldX, deckHeight, worldZ),
      group: station,
    }
    if (isMedical) state.medicalStations.push(stationData)
    else state.ammoStations.push(stationData)
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
    map,
  }) {
    const group = new THREE.Group()
    group.position.set(x, 0, z)

    const fortressMetal = matLib.metal.clone()
    fortressMetal.color.set(0x65747d)
    fortressMetal.roughness = 0.38
    fortressMetal.metalness = 0.92
    fortressMetal.envMapIntensity = 0.78
    const fortressDeckMetal = fortressMetal.clone()
    fortressDeckMetal.color.set(0x3d5059)
    fortressDeckMetal.roughness = 0.3
    fortressDeckMetal.envMapIntensity = 0.9

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

    addFrustumObstacle({
      type: 'fortress-frustum',
      x,
      z,
      bottomRadius,
      topRadius,
      height: deckHeight,
    })
    map.addFrustumRegion({
      x,
      z,
      bottomRadius,
      topRadius,
      height: deckHeight,
    })

    scene.add(group)
    matLib.addOutline(group, 1.025)

    const fortress = {
      kind: 'fortress',
      position: new THREE.Vector3(x, 0, z),
      radius,
      attackRadius,
      maxHealth,
      health: maxHealth,
      deckHeight,
      bottomRadius,
      topRadius,
      group,
    }
    state.objectives.fortress = fortress
    state.coverPoints.push({ x, z, r: radius, type: 'fortress' })
    return fortress
  }

  return { createFortress }
}
