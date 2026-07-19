import * as THREE from 'three'

export function createEffectsSystem({ scene, state, audio }) {
  function update(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const particle = state.particles[i]
      particle.life -= dt
      if (particle.life <= 0) {
        scene.remove(particle.mesh)
        particle.onComplete?.()
        state.particles.splice(i, 1)
      } else {
        particle.update?.(dt, particle.maxLife - particle.life, particle)
      }
    }
  }

  function addTracer(origin, end) {
    const geometry = new THREE.BufferGeometry().setFromPoints([origin, end])
    const material = new THREE.LineBasicMaterial({
      color: 0xffdd88,
      transparent: true,
      opacity: 0.72,
    })
    const tracer = new THREE.Line(geometry, material)
    scene.add(tracer)
    state.particles.push({
      mesh: tracer,
      type: 'tracer',
      life: 0.06,
      maxLife: 0.06,
      update: () => {
        material.opacity *= 0.82
      },
    })
  }

  function spawnMuzzleFlash(pos, dir, firstPerson = false) {
    const direction = dir.clone().normalize()
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(firstPerson ? 0.065 : 0.11, 7, 5),
      new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.98 })
    )
    core.position.copy(pos).addScaledVector(direction, firstPerson ? 0.04 : 0.08)
    scene.add(core)
    const flare = new THREE.Mesh(
      new THREE.ConeGeometry(firstPerson ? 0.055 : 0.1, firstPerson ? 0.18 : 0.26, 7, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff9028,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      })
    )
    flare.position.copy(pos).addScaledVector(direction, firstPerson ? 0.11 : 0.15)
    flare.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    scene.add(flare)
    const side = new THREE.Mesh(
      new THREE.SphereGeometry(firstPerson ? 0.05 : 0.075, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffc45a, transparent: true, opacity: 0.75 })
    )
    side.position.copy(pos).addScaledVector(direction, firstPerson ? 0.02 : 0.05)
    side.scale.set(1.7, 0.5, 0.5)
    scene.add(side)
    const light = new THREE.PointLight(0xffa040, firstPerson ? 2.8 : 4.0, firstPerson ? 5 : 8)
    light.position.copy(pos)
    scene.add(light)
    const life = firstPerson ? 0.05 : 0.06
    state.particles.push({
      mesh: core,
      type: 'flash',
      life,
      maxLife: life,
      update: (dt, time) => {
        const progress = 1 - time / life
        core.material.opacity = progress * 0.98
        core.scale.setScalar(0.65 + (1 - progress) * 2.0)
        flare.material.opacity = progress * 0.8
        flare.scale.setScalar(0.8 + (1 - progress) * 1.55)
        side.material.opacity = progress * 0.75
        side.scale.set(
          1.7 + (1 - progress) * 1.1,
          0.5 + (1 - progress) * 0.45,
          0.5 + (1 - progress) * 0.45
        )
        light.intensity = progress * (firstPerson ? 2.8 : 4.0)
      },
      onComplete: () => {
        scene.remove(light)
        scene.remove(flare)
        scene.remove(side)
      },
    })

    const count = firstPerson ? 3 : 4
    for (let i = 0; i < count; i++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 5, 4),
        new THREE.MeshBasicMaterial({
          color: 0xb8a898,
          transparent: true,
          opacity: firstPerson ? 0.22 : 0.4,
          depthWrite: false,
        })
      )
      puff.position.copy(pos).addScaledVector(direction, 0.08 + i * 0.04)
      scene.add(puff)
      const velocity = direction
        .clone()
        .multiplyScalar(0.55 + Math.random() * 0.45)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.4,
            0.18 + Math.random() * 0.28,
            (Math.random() - 0.5) * 0.4
          )
        )
      const maxLife = 0.4 + i * 0.09
      state.particles.push({
        mesh: puff,
        type: 'smoke',
        life: maxLife,
        maxLife,
        vel: velocity,
        update: (dt, time, particle) => {
          particle.mesh.position.addScaledVector(particle.vel, dt)
          particle.vel.multiplyScalar(0.91)
          particle.mesh.material.opacity =
            (1 - time / particle.maxLife) * (firstPerson ? 0.22 : 0.4)
          particle.mesh.scale.setScalar(1 + time * 2.6)
        },
      })
    }
  }

  function spawnShell(pos, right = null, up = null) {
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.007, 0.028, 6),
      new THREE.MeshStandardMaterial({ color: 0xc0a040, metalness: 0.85, roughness: 0.28 })
    )
    shell.position.copy(pos)
    shell.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
    scene.add(shell)
    const rightAxis = right ? right.clone().normalize() : new THREE.Vector3(1, 0, 0)
    const upAxis = up ? up.clone().normalize() : new THREE.Vector3(0, 1, 0)
    const forward = new THREE.Vector3().crossVectors(upAxis, rightAxis).normalize()
    const velocity = rightAxis
      .multiplyScalar(2.2 + Math.random() * 0.9)
      .addScaledVector(upAxis, 1.4 + Math.random() * 0.7)
      .addScaledVector(forward, -0.3 + Math.random() * 0.4)
    let landed = false
    state.particles.push({
      mesh: shell,
      type: 'shell',
      life: 1.4,
      maxLife: 1.4,
      vel: velocity,
      rotVel: new THREE.Vector3(
        8 + Math.random() * 10,
        6 + Math.random() * 8,
        4 + Math.random() * 6
      ),
      update: (dt, time, particle) => {
        particle.vel.y -= 9.8 * dt
        particle.mesh.position.addScaledVector(particle.vel, dt)
        particle.mesh.rotation.x += particle.rotVel.x * dt
        particle.mesh.rotation.y += particle.rotVel.y * dt
        particle.mesh.rotation.z += particle.rotVel.z * dt
        if (particle.mesh.position.y < 0.02) {
          if (!landed) {
            landed = true
            if (Math.random() < 0.4) audio.shellDrop(particle.mesh.position)
          }
          particle.mesh.position.y = 0.02
          particle.vel.y *= -0.28
          particle.vel.x *= 0.65
          particle.vel.z *= 0.65
          particle.rotVel.multiplyScalar(0.6)
        }
      },
    })
  }

  function spawnSmokePuff(pos) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 4, 3),
      new THREE.MeshBasicMaterial({ color: 0xb0a090, transparent: true, opacity: 0.12 })
    )
    puff.position.copy(pos)
    scene.add(puff)
    state.particles.push({
      mesh: puff,
      type: 'smoke',
      life: 0.55,
      maxLife: 0.55,
      update: (dt, time, particle) => {
        particle.mesh.material.opacity = (1 - time / 0.55) * 0.12
        particle.mesh.scale.setScalar(1 + time * 2.6)
        particle.mesh.position.y += dt * 0.18
      },
    })
  }

  function spawnSpark(pos, dir) {
    for (let i = 0; i < 6; i++) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 4, 3),
        new THREE.MeshBasicMaterial({ color: 0xffaa30, transparent: true })
      )
      spark.position.copy(pos)
      scene.add(spark)
      const velocity = dir
        .clone()
        .multiplyScalar(-1)
        .add(
          new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2)
        )
        .multiplyScalar(2)
      state.particles.push({
        mesh: spark,
        type: 'spark',
        life: 0.3,
        maxLife: 0.3,
        vel: velocity,
        update: (dt, time, particle) => {
          particle.vel.y -= 6 * dt
          particle.mesh.position.addScaledVector(particle.vel, dt)
          particle.mesh.material.opacity = 1 - time / 0.3
        },
      })
    }
    const dust = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 4, 3),
      new THREE.MeshBasicMaterial({ color: 0xa09080, transparent: true, opacity: 0.5 })
    )
    dust.position.copy(pos)
    scene.add(dust)
    state.particles.push({
      mesh: dust,
      type: 'dust',
      life: 0.5,
      maxLife: 0.5,
      update: (dt, time, particle) => {
        particle.mesh.material.opacity = (1 - time / 0.5) * 0.5
        particle.mesh.scale.setScalar(1 + time * 4)
      },
    })
  }

  function spawnBlood(pos) {
    for (let i = 0; i < 10; i++) {
      const blood = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 4, 3),
        new THREE.MeshBasicMaterial({ color: 0x8a1010 })
      )
      blood.position.copy(pos)
      scene.add(blood)
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 2,
        (Math.random() - 0.5) * 3
      )
      state.particles.push({
        mesh: blood,
        type: 'blood',
        life: 0.8,
        maxLife: 0.8,
        vel: velocity,
        update: (dt, time, particle) => {
          particle.vel.y -= 9 * dt
          particle.mesh.position.addScaledVector(particle.vel, dt)
          if (particle.mesh.position.y < 0.02) {
            particle.mesh.position.y = 0.02
            particle.vel.set(0, 0, 0)
          }
        },
      })
    }
  }

  return { update, addTracer, spawnMuzzleFlash, spawnShell, spawnSmokePuff, spawnSpark, spawnBlood }
}
