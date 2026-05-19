import { useMemo } from "react"
import { AlertTriangle } from "lucide-react"
import { ResponsiveContainer, Sankey, Tooltip } from "recharts"

const CLASS_COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#f59e0b", "#ef4444", "#7c3aed", "#db2777"]
const CLUSTER_COLORS = ["#1d4ed8", "#0f766e", "#be123c", "#7c2d12", "#4338ca", "#15803d", "#9f1239"]
const WARNING_COLOR = "#f59e0b"

function formatClusterName(clusterValue) {
  if (clusterValue === null || clusterValue === undefined) return "No Cluster"
  return `Cluster ${clusterValue}`
}

function normalizeClassLabel(value) {
  if (value === null || value === undefined || value === "") return "Unclassified"
  return String(value)
}

function normalizeClusterKey(value) {
  return value === null || value === undefined ? "no-cluster" : String(value)
}

function getPercent(value, total) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function buildSankeyBridgeData(attempts = []) {
  const classMap = new Map()
  const clusterMap = new Map()
  const overlapMap = new Map()

  attempts.forEach((attempt) => {
    const classLabel = normalizeClassLabel(attempt.supervised_class)
    const clusterValue = attempt.unsupervised_cluster ?? null
    const clusterKey = normalizeClusterKey(clusterValue)

    if (!classMap.has(classLabel)) {
      classMap.set(classLabel, { key: classLabel, label: classLabel, count: 0, students: [] })
    }
    if (!clusterMap.has(clusterKey)) {
      clusterMap.set(clusterKey, {
        key: clusterKey,
        value: clusterValue,
        label: formatClusterName(clusterValue),
        count: 0,
        students: [],
      })
    }

    classMap.get(classLabel).count += 1
    classMap.get(classLabel).students.push(attempt)
    clusterMap.get(clusterKey).count += 1
    clusterMap.get(clusterKey).students.push(attempt)

    const overlapKey = `${classLabel}||${clusterKey}`
    const current = overlapMap.get(overlapKey) || { classLabel, clusterKey, count: 0, students: [] }
    current.count += 1
    current.students.push(attempt)
    overlapMap.set(overlapKey, current)
  })

  const classes = Array.from(classMap.values()).sort((a, b) => b.count - a.count)
  const clusters = Array.from(clusterMap.values()).sort((a, b) => {
    if (a.value === null && b.value !== null) return 1
    if (a.value !== null && b.value === null) return -1
    return Number(a.value ?? 999) - Number(b.value ?? 999)
  })

  const classIndex = new Map()
  const clusterIndex = new Map()
  const nodes = [
    ...classes.map((item, index) => {
      classIndex.set(item.label, index)
      return {
        ...item,
        name: `${item.label} (${item.count})`,
        type: "class",
        color: CLASS_COLORS[index % CLASS_COLORS.length],
      }
    }),
    ...clusters.map((item, index) => {
      const nodeIndex = classes.length + index
      clusterIndex.set(item.key, nodeIndex)
      return {
        ...item,
        name: `${item.label} (${item.count})`,
        type: "cluster",
        color: CLUSTER_COLORS[index % CLUSTER_COLORS.length],
      }
    }),
  ]

  const discrepancyByClass = {}
  classes.forEach((classItem) => {
    const counts = clusters.map((cluster) => overlapMap.get(`${classItem.label}||${cluster.key}`)?.count || 0)
    const activeClusters = counts.filter((count) => count > 0).length
    const maxShare = classItem.count ? Math.max(...counts, 0) / classItem.count : 1
    const score = activeClusters >= 2 ? 1 - maxShare : 0
    discrepancyByClass[classItem.label] = {
      score,
      mixed: score > 0.35,
      activeClusters,
    }
  })

  const links = Array.from(overlapMap.values())
    .filter((item) => item.count > 0)
    .map((item) => {
      const sourceIndex = classIndex.get(item.classLabel)
      const targetIndex = clusterIndex.get(item.clusterKey)
      const sourceNode = nodes[sourceIndex]
      const targetNode = nodes[targetIndex]
      const discrepancy = discrepancyByClass[item.classLabel]
      return {
        source: sourceIndex,
        target: targetIndex,
        value: item.count,
        students: item.students,
        classLabel: item.classLabel,
        clusterLabel: targetNode?.label,
        color: discrepancy?.mixed ? WARNING_COLOR : sourceNode?.color,
        warning: !!discrepancy?.mixed,
      }
    })

  const matrix = classes.map((classItem) => ({
    classLabel: classItem.label,
    count: classItem.count,
    warning: !!discrepancyByClass[classItem.label]?.mixed,
    discrepancyScore: discrepancyByClass[classItem.label]?.score || 0,
    cells: clusters.map((cluster) => {
      const count = overlapMap.get(`${classItem.label}||${cluster.key}`)?.count || 0
      return {
        clusterKey: cluster.key,
        clusterLabel: cluster.label,
        count,
        percent: getPercent(count, classItem.count),
      }
    }),
  }))

  return {
    nodes,
    links,
    classes,
    clusters,
    matrix,
    discrepancyByClass,
    hasSupervised: attempts.some((attempt) => attempt.supervised_class !== null && attempt.supervised_class !== undefined && attempt.supervised_class !== ""),
    hasClusters: attempts.some((attempt) => attempt.unsupervised_cluster !== null && attempt.unsupervised_cluster !== undefined),
  }
}

function SankeyNode({ x, y, width, height, payload }) {
  if (!payload) return null
  const labelX = payload.type === "class" ? x + width + 8 : x - 8
  const anchor = payload.type === "class" ? "start" : "end"

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={payload.color} stroke="#ffffff" strokeWidth={1} />
      <text x={labelX} y={y + height / 2 - 2} textAnchor={anchor} className="fill-[#1a1a2e] text-[11px] font-bold">
        {payload.label}
      </text>
      <text x={labelX} y={y + height / 2 + 12} textAnchor={anchor} className="fill-gray-500 text-[10px] font-semibold">
        {payload.count} students
      </text>
    </g>
  )
}

function SankeyLink({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload }) {
  const path = `
    M${sourceX},${sourceY}
    C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
  `
  return (
    <path
      d={path}
      fill="none"
      stroke={payload?.color || "#94a3b8"}
      strokeOpacity={payload?.warning ? 0.78 : 0.38}
      strokeWidth={Math.max(linkWidth, 2)}
      strokeLinecap="round"
    />
  )
}

function BridgeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload
  if (!item) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-[#1a1a2e]">{item.classLabel} to {item.clusterLabel}</p>
      <p className="text-gray-600 mt-1">{item.value} students</p>
      {item.warning && (
        <p className="text-amber-700 font-semibold mt-1">Students in this group show mixed real-world behaviour.</p>
      )}
    </div>
  )
}

function NoticeBanner({ children }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
      {children}
    </div>
  )
}

export default function SankeyBridgeChart({ attempts, viewMode = "combined" }) {
  const bridge = useMemo(() => buildSankeyBridgeData(attempts), [attempts])
  const showSupervised = viewMode !== "clusters"
  const showClusters = viewMode !== "supervised"
  const canShowSupervised = showSupervised && (bridge.hasSupervised || !bridge.hasClusters)
  const canShowClusters = showClusters && (bridge.hasClusters || !bridge.hasSupervised)
  const showCombined = viewMode === "combined" && bridge.hasSupervised && bridge.hasClusters && bridge.links.length > 0

  if (!attempts?.length) {
    return <p className="text-sm text-gray-500">No analytics data available for this exam.</p>
  }

  return (
    <div className="space-y-4">
      {!bridge.hasSupervised && <NoticeBanner>Supervised model output is unavailable. Showing cluster-side data only.</NoticeBanner>}
      {!bridge.hasClusters && <NoticeBanner>KMeans cluster output is unavailable. Showing supervised-side data only.</NoticeBanner>}

      {showCombined ? (
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={{ nodes: bridge.nodes, links: bridge.links }}
              node={SankeyNode}
              link={SankeyLink}
              nodePadding={24}
              nodeWidth={16}
              margin={{ top: 16, right: 120, bottom: 16, left: 140 }}
              iterations={32}
              sort={false}
            >
              <Tooltip content={<BridgeTooltip />} />
            </Sankey>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {canShowSupervised && bridge.classes.map((item, index) => (
            <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-[#1a1a2e]">{item.label}</span>
                <span className="text-xs font-bold" style={{ color: CLASS_COLORS[index % CLASS_COLORS.length] }}>{item.count}</span>
              </div>
            </div>
          ))}
          {canShowClusters && bridge.clusters.map((item, index) => (
            <div key={item.key} className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-[#1a1a2e]">{item.label}</span>
                <span className="text-xs font-bold" style={{ color: CLUSTER_COLORS[index % CLUSTER_COLORS.length] }}>{item.count}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {bridge.matrix.length > 0 && bridge.clusters.length > 0 && bridge.hasSupervised && bridge.hasClusters && showSupervised && showClusters && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-bold">Supervised class</th>
                {bridge.clusters.map((cluster) => (
                  <th key={cluster.key} className="px-3 py-2 text-center font-bold whitespace-nowrap">{cluster.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {bridge.matrix.map((row) => (
                <tr key={row.classLabel}>
                  <td className="px-3 py-2 font-bold text-[#1a1a2e] whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {row.warning && (
                        <span title="Students in this group show mixed real-world behaviour — consider splitting this class" className="text-amber-600">
                          <AlertTriangle size={13} />
                        </span>
                      )}
                      {row.classLabel}
                    </span>
                    {row.warning && <span className="ml-2 text-[10px] font-semibold text-amber-700">{Math.round(row.discrepancyScore * 100)}% mixed</span>}
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.clusterKey} className="px-3 py-2 text-center font-semibold text-gray-600">
                      {cell.percent}% <span className="text-gray-400">({cell.count})</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
