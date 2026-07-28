import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const _object = new THREE.Object3D()

/** 将同材质零件烘焙为单个 Mesh。def: { geometry, position?, rotation?, scale? } */
export function createMergedMesh(defs, material) {
  const geometries = []
  for (const def of defs) {
    _object.position.set(0, 0, 0)
    _object.rotation.set(0, 0, 0)
    _object.scale.set(1, 1, 1)
    if (def.position) _object.position.fromArray(def.position)
    if (def.rotation) _object.rotation.set(def.rotation[0], def.rotation[1], def.rotation[2])
    if (def.scale) {
      if (Array.isArray(def.scale)) _object.scale.fromArray(def.scale)
      else _object.scale.setScalar(def.scale)
    }
    _object.updateMatrix()
    const geometry = def.geometry.clone()
    geometry.applyMatrix4(_object.matrix)
    geometries.push(geometry)
  }
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  const mesh = new THREE.Mesh(merged, material)
  mesh.castShadow = false
  mesh.receiveShadow = false
  return mesh
}
