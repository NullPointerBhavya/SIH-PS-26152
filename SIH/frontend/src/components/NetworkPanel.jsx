import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

/* Force-directed 3D Layout */
function forceLayout(nodes, edges, iterations = 60) {
  const pos = {}
  const count = Math.max(nodes.length, 1)

  nodes.forEach((n, i) => {
    const angle = (i / count) * Math.PI * 2
    const radius = 3.5 + (i % 3) * 0.8
    pos[n.id] = new THREE.Vector3(
      Math.cos(angle) * radius + (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 3,
      Math.sin(angle) * radius + (Math.random() - 0.5) * 1.5
    )
  })

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const idA = nodes[i].id
        const idB = nodes[j].id
        const a = pos[idA]
        const b = pos[idB]
        if (!a || !b) continue
        const diff = a.clone().sub(b)
        const dist = Math.max(diff.length(), 0.5)
        const force = diff.normalize().multiplyScalar(1.2 / (dist * dist))
        a.add(force)
        b.sub(force)
      }
    }

    // Attraction
    for (const edge of edges) {
      const a = pos[edge.source]
      const b = pos[edge.target]
      if (!a || !b) continue
      const diff = b.clone().sub(a)
      const dist = diff.length()
      const force = diff.normalize().multiplyScalar(dist * 0.04)
      a.add(force)
      b.sub(force)
    }
  }

  return pos
}

function GraphNodes({ nodes, positions, onSelectNode }) {
  const groupRef = useRef()

  const nodeElements = useMemo(() => {
    return nodes.map((node, i) => {
      const p = positions[node.id] || new THREE.Vector3(0, 0, 0)
      const score = Number(node.influence_score ?? node.score ?? 0.5)
      const size = Math.max(0.18, Math.min(0.5, score * 0.6))
      
      let color = '#ccff00' // default amplifier
      if (node.archetype === 'authority') color = '#7c3aed'
      else if (node.archetype === 'bridge') color = '#00d4ff'
      else if (node.archetype === 'critic') color = '#f43f5e'
      else if (node.dominant_sentiment === 'positive') color = '#ccff00'
      else if (node.dominant_sentiment === 'negative') color = '#f43f5e'

      return {
        id: node.id,
        position: [p.x, p.y, p.z],
        color,
        size,
        data: node
      }
    })
  }, [nodes, positions])

  return (
    <group ref={groupRef}>
      {nodeElements.map((item, idx) => (
        <group key={idx} position={item.position}>
          {/* Core sphere */}
          <mesh onClick={() => onSelectNode(item.data)}>
            <sphereGeometry args={[item.size, 16, 16]} />
            <meshStandardMaterial
              color={item.color}
              emissive={item.color}
              emissiveIntensity={0.6}
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>
          {/* Wireframe aura */}
          <mesh>
            <sphereGeometry args={[item.size * 1.35, 8, 8]} />
            <meshBasicMaterial color={item.color} wireframe transparent opacity={0.35} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function GraphEdges({ edges, positions }) {
  const geometry = useMemo(() => {
    const points = []
    edges.forEach(edge => {
      const a = positions[edge.source]
      const b = positions[edge.target]
      if (a && b) {
        points.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    })
    const geo = new THREE.BufferGeometry()
    if (points.length > 0) {
      geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    }
    return geo
  }, [edges, positions])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#7c3aed" transparent opacity={0.35} />
    </lineSegments>
  )
}

function NetworkScene({ nodes, edges, onSelectNode }) {
  const positions = useMemo(() => {
    return forceLayout(nodes, edges)
  }, [nodes, edges])

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-8, -8, -5]} intensity={1.0} color="#ccff00" />
      <GraphEdges edges={edges} positions={positions} />
      <GraphNodes nodes={nodes} positions={positions} onSelectNode={onSelectNode} />
      <OrbitControls enableDamping dampingFactor={0.08} autoRotate autoRotateSpeed={0.4} />
    </>
  )
}

export default function NetworkPanel({ data }) {
  const [selectedNode, setSelectedNode] = useState(null)

  if (!data || (!data.total_nodes && !data.nodes && !data.influencers)) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔗</div>
        <h4>No Topology Graph Computed</h4>
        <p>Enable Network Topology in the Command Center or load the Demo Intelligence Dataset to inspect interactive 3D link analysis and Key Opinion Leaders.</p>
      </div>
    )
  }

  // Parse raw nodes
  const rawNodes = data.nodes || data.all_nodes || data.influencers || []
  const nodes = useMemo(() => {
    return rawNodes.map((n, i) => ({
      id: String(n.id || n.handle || n.user_id || `node_${i}`),
      label: n.label || n.handle || n.display_name || `Node ${i + 1}`,
      influence_score: n.influence_score ?? n.score ?? 0.5,
      followers_count: n.followers_count || 0,
      archetype: n.archetype || 'amplifier',
      pagerank: n.pagerank || 0.05,
      in_degree: n.in_degree || 1,
      dominant_sentiment: n.dominant_sentiment || 'positive',
    }))
  }, [rawNodes])

  // Parse raw edges
  const rawEdges = data.links || data.all_edges || data.edges || []
  const edges = useMemo(() => {
    return rawEdges.map(e => ({
      source: String(e.source || e.source_user_id),
      target: String(e.target || e.target_user_id),
      edge_type: e.edge_type || 'interaction',
    }))
  }, [rawEdges])

  const influencers = data.influencers || nodes.slice(0, 8)
  const communities = data.communities || []
  const cascades = data.spread_cascade || []

  return (
    <div>
      {/* Stats Banner */}
      <div className="stats-banner">
        <div className="stat-item">
          <span className="stat-label">Total Nodes</span>
          <span className="stat-value accent-lime">{nodes.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Total Edges</span>
          <span className="stat-value accent-purple">{edges.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Identified KOLs</span>
          <span className="stat-value accent-cyan">{influencers.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Communities</span>
          <span className="stat-value accent-emerald">{communities.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Graph Density</span>
          <span className="stat-value">{data.graph_density?.toFixed(3) || '0.142'}</span>
        </div>
      </div>

      {/* 3D Force Directed Graph Canvas */}
      <div className="network-container">
        <Canvas camera={{ position: [0, 0, 9], fov: 50 }} dpr={[1, 2]}>
          <NetworkScene nodes={nodes} edges={edges} onSelectNode={setSelectedNode} />
        </Canvas>

        {/* Telemetry HUD */}
        <div className="network-overlay">
          <span className="network-stat-pill">
            <span style={{ color: 'var(--accent-lime)' }}>●</span> {nodes.length} INTERACTION NODES
          </span>
          <span className="network-stat-pill">
            <span style={{ color: 'var(--accent-purple)' }}>─</span> {edges.length} DIFFUSION BRIDGES
          </span>
          <span className="network-stat-pill" style={{ fontSize: '0.65rem' }}>
            DRAG TO ROTATE // SCROLL TO ZOOM
          </span>
        </div>

        {/* Selected Node Inspector Drawer */}
        {selectedNode && (
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            background: 'var(--bg-acid-yellow)',
            border: '2px solid #000',
            boxShadow: '3px 3px 0px #000',
            padding: '12px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.74rem',
            color: '#000',
            zIndex: 10,
            maxWidth: '300px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong>@{selectedNode.id}</strong>
              <button
                onClick={() => setSelectedNode(null)}
                style={{ background: 'none', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: '1rem' }}
              >
                ×
              </button>
            </div>
            <div>Archetype: <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{selectedNode.archetype}</span></div>
            <div>Influence: {Number(selectedNode.influence_score).toFixed(3)}</div>
            <div>In-Degree: {selectedNode.in_degree} connections</div>
          </div>
        )}
      </div>

      {/* KOL Influencers Leaderboard */}
      {influencers.length > 0 && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <div className="intel-card">
            <div className="intel-card-header">
              <span>/01 Key Opinion Leaders (KOLs) — Centrality & Influence Ranking</span>
              <span style={{ color: 'var(--accent-purple)' }}>Top Authorities</span>
            </div>
            <div className="intel-card-body">
              <div className="kol-grid">
                {influencers.slice(0, 8).map((kol, i) => {
                  const handle = kol.handle || kol.id || kol.user_id || 'user'
                  const score = Number(kol.influence_score ?? kol.score ?? 0.5)
                  const rank = i + 1
                  return (
                    <div className="kol-card" key={i}>
                      <div className="kol-header">
                        <span className="kol-rank">#{rank < 10 ? `0${rank}` : rank}</span>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: kol.archetype === 'authority' ? 'var(--accent-purple)' : 'var(--text-secondary)'
                        }}>
                          {kol.archetype || 'Amplifier'}
                        </span>
                      </div>
                      <div className="kol-name">@{handle}</div>
                      <div className="kol-metrics">
                        <span className="kol-metric-label">Influence Score</span>
                        <span className="kol-metric-val">{score.toFixed(3)}</span>
                        <span className="kol-metric-label">PageRank</span>
                        <span className="kol-metric-val">{Number(kol.pagerank ?? 0.05).toFixed(4)}</span>
                        <span className="kol-metric-label">In-Degree Centrality</span>
                        <span className="kol-metric-val">{kol.in_degree ?? 1}</span>
                        <span className="kol-metric-label">Dominant Tone</span>
                        <span className="kol-metric-val" style={{
                          color: kol.dominant_sentiment === 'positive' ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                        }}>
                          {kol.dominant_sentiment || 'Neutral'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Community Clusters & Spread Cascade */}
      {communities.length > 0 && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <div className="intel-card">
            <div className="intel-card-header">
              <span>/02 Discovered Sub-Communities (Louvain Modularity Partitioning)</span>
              <span style={{ color: 'var(--accent-emerald)' }}>{communities.length} Clusters</span>
            </div>
            <div className="intel-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
                {communities.map((c, i) => (
                  <div key={i} style={{
                    padding: 'var(--space-md)',
                    border: '2px solid #000',
                    background: 'var(--bg-secondary)',
                    boxShadow: '3px 3px 0px #000'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ width: '12px', height: '12px', background: c.color || 'var(--accent-purple)', border: '1px solid #000' }} />
                      <strong style={{ fontSize: '0.85rem' }}>{c.label}</strong>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Members: {c.member_count || 0} accounts
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Top Influencers: {(c.top_influencers || []).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
