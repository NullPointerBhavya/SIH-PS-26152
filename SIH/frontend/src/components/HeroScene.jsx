import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function CyberCluster() {
  const groupRef = useRef()
  const innerRef = useRef()

  // Generate voxel block positions with cyberpunk cyber-brutalist styling
  const blocks = useMemo(() => {
    const list = []
    const colors = ['#7c3aed', '#ccff00', '#00d4ff', '#1a1a24', '#2d2d3a', '#9061f9']
    
    // Core cluster blocks
    for (let x = -1.5; x <= 1.5; x += 0.75) {
      for (let y = -1.5; y <= 1.5; y += 0.75) {
        for (let z = -1.2; z <= 1.2; z += 0.8) {
          if (Math.random() > 0.45) {
            const isAccent = Math.random() > 0.6
            const color = isAccent 
              ? (Math.random() > 0.5 ? '#ccff00' : '#7c3aed') 
              : colors[Math.floor(Math.random() * colors.length)]
            const isWire = Math.random() > 0.65
            const scale = 0.4 + Math.random() * 0.35
            list.push({ pos: [x, y, z], color, isWire, scale })
          }
        }
      }
    }
    return list
  }, [])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.rotation.y = t * 0.15
    groupRef.current.rotation.x = Math.sin(t * 0.08) * 0.18
    if (innerRef.current) {
      innerRef.current.rotation.y = -t * 0.25
      innerRef.current.rotation.z = Math.cos(t * 0.1) * 0.15
    }
  })

  return (
    <group ref={groupRef}>
      {/* Outer bounding wireframe box */}
      <mesh>
        <boxGeometry args={[3.8, 3.8, 3.8]} />
        <meshBasicMaterial color="#7c3aed" wireframe transparent opacity={0.12} />
      </mesh>

      {/* Secondary wireframe sphere */}
      <mesh>
        <sphereGeometry args={[2.5, 16, 16]} />
        <meshBasicMaterial color="#ccff00" wireframe transparent opacity={0.08} />
      </mesh>

      {/* Inner cluster */}
      <group ref={innerRef}>
        {blocks.map((b, i) => (
          <mesh key={i} position={b.pos} scale={[b.scale, b.scale, b.scale]}>
            <boxGeometry args={[1, 1, 1]} />
            {b.isWire ? (
              <meshBasicMaterial color={b.color} wireframe transparent opacity={0.7} />
            ) : (
              <meshStandardMaterial
                color={b.color}
                roughness={0.2}
                metalness={0.8}
                transparent={b.color === '#7c3aed' || b.color === '#ccff00'}
                opacity={b.color === '#ccff00' ? 0.85 : 0.75}
              />
            )}
          </mesh>
        ))}
      </group>
    </group>
  )
}

function FloatingParticles({ count = 280 }) {
  const pointsRef = useRef()

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const cols = new Float32Array(count * 3)
    const colorA = new THREE.Color('#ccff00')
    const colorB = new THREE.Color('#7c3aed')
    const colorC = new THREE.Color('#00d4ff')

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8

      const chosen = Math.random() > 0.6 ? colorA : (Math.random() > 0.5 ? colorB : colorC)
      cols[i * 3] = chosen.r
      cols[i * 3 + 1] = chosen.g
      cols[i * 3 + 2] = chosen.b
    }
    return [pos, cols]
  }, [count])

  useFrame((state) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.04
    pointsRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.02) * 0.05
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.75}
        sizeAttenuation
      />
    </points>
  )
}

function CyberGridFloor() {
  return (
    <group position={[0, -2.6, 0]}>
      <gridHelper args={[16, 24, '#7c3aed', '#1f1f2e']} />
    </group>
  )
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6.2], fov: 48 }}
      style={{ background: 'transparent' }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-4, -3, 3]} intensity={1.5} color="#7c3aed" />
      <pointLight position={[4, 3, -2]} intensity={1.8} color="#ccff00" />
      <CyberGridFloor />
      <CyberCluster />
      <FloatingParticles count={250} />
    </Canvas>
  )
}
