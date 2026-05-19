import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, X } from "lucide-react"
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

function formatScore(value) {
  if (value === null || value === undefined) return "Score unavailable"
  return `Score ${Math.round(Number(value))}%`
}

function formatTime(value) {
  if (value === null || value === undefined) return "Time unavailable"
  return `${Math.round(Number(value))}s avg time`
}

function formatMinutes(seconds) {
  if (seconds === null || seconds === undefined) return "Unavailable"
  return `${Math.round(Number(seconds) / 60)} min`
}

function normalizeStudent(attempt) {
  return {
    studentId: attempt.student_id,
    studentName: attempt.student_name || "Unknown Student",
    score: attempt.score ?? null,
    timeTaken: attempt.avg_time_sec ?? null,
    kmeanCluster: attempt.unsupervised_cluster ?? null,
    supervisedClass: normalizeClassLabel(attempt.supervised_class),
    studentEmail: attempt.student_email || "",
  }
}

function computeStdDev(values) {
  if (values.length <= 1) return 0
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length
  return Math.sqrt(variance)
}

function getBehaviourSummary(metrics) {
  if (metrics.consistencyLabel !== "Consistent") return "Performance varies widely - individual attention recommended"
  if (metrics.timeLabel === "Quick" && metrics.avgScore < 50) return "This group may be rushing through questions"
  if (metrics.timeLabel === "Thorough" && metrics.avgScore >= 80) return "This group takes time and performs well"
  if (metrics.avgScore >= 80) return "This group works efficiently and accurately"
  if (metrics.avgScore < 50) return "This group struggles consistently - may need foundational support"
  return "This group is steady, with room to strengthen accuracy"
}

function computeClusterMetrics(cluster) {
  const students = cluster?.students || []
  const scores = students
    .map((student) => Number(student.score))
    .filter((value) => Number.isFinite(value))
  const times = students
    .map((student) => Number(student.timeTaken))
    .filter((value) => Number.isFinite(value))

  const studentCount = students.length
  const avgScore = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0
  const scoreRange = scores.length ? [Math.round(Math.min(...scores)), Math.round(Math.max(...scores))] : [0, 0]
  const highPerformers = scores.filter((score) => score > 80).length
  const strugglingStudents = scores.filter((score) => score < 50).length
  const avgTimeTaken = times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0
  const avgTimeMinutes = avgTimeTaken / 60
  const timeLabel = avgTimeMinutes < 10 ? "Quick" : avgTimeMinutes <= 25 ? "Moderate" : "Thorough"
  const scoreStdDev = computeStdDev(scores)
  const consistencyLabel = scoreStdDev < 10 ? "Consistent" : scoreStdDev <= 20 ? "Variable" : "Highly Variable"

  const classCounts = new Map()
  students.forEach((student) => {
    const classLabel = student.supervisedClass || "Unclassified"
    classCounts.set(classLabel, (classCounts.get(classLabel) || 0) + 1)
  })
  const dominantEntry = Array.from(classCounts.entries()).sort((a, b) => b[1] - a[1])[0]
  const dominantSupClass = dominantEntry?.[0] || "Unclassified"
  const dominantSupClassPct = studentCount ? Math.round((dominantEntry?.[1] || 0) / studentCount * 100) : 0
  const isMixed = dominantSupClassPct < 65

  return {
    studentCount,
    avgScore,
    scoreRange,
    highPerformers,
    strugglingStudents,
    avgTimeTaken,
    timeLabel,
    scoreStdDev,
    consistencyLabel,
    dominantSupClass,
    dominantSupClassPct,
    isMixed,
    mixedWarning: isMixed
      ? "Students in this cluster span multiple preset behaviour types - they may need differentiated attention"
      : null,
    behaviourSummary: getBehaviourSummary({ avgScore, timeLabel, consistencyLabel }),
  }
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
    classMap.get(classLabel).students.push(normalizeStudent(attempt))
    clusterMap.get(clusterKey).count += 1
    clusterMap.get(clusterKey).students.push(normalizeStudent(attempt))

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

  const dominantClassByCluster = {}
  clusters.forEach((cluster) => {
    const dominant = classes
      .map((classItem) => ({
        classLabel: classItem.label,
        count: overlapMap.get(`${classItem.label}||${cluster.key}`)?.count || 0,
      }))
      .sort((a, b) => b.count - a.count)[0]
    dominantClassByCluster[cluster.key] = dominant?.count > 0 ? dominant.classLabel : null
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
        classLabel: item.label,
        studentCount: item.count,
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
        clusterId: item.value,
        studentCount: item.count,
        dominantClass: dominantClassByCluster[item.key],
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
    dominantClassByCluster,
    hasSupervised: attempts.some((attempt) => attempt.supervised_class !== null && attempt.supervised_class !== undefined && attempt.supervised_class !== ""),
    hasClusters: attempts.some((attempt) => attempt.unsupervised_cluster !== null && attempt.unsupervised_cluster !== undefined),
  }
}

function SankeyNode({ x, y, width, height, payload, onNodeClick, hoveredNodeKey, onNodeHover }) {
  if (!payload) return null
  const labelX = payload.type === "class" ? x + width + 8 : x - 8
  const anchor = payload.type === "class" ? "start" : "end"
  const clickable = (payload.type === "class" || payload.type === "cluster") && payload.students?.length > 0
  const hovered = hoveredNodeKey === payload.key

  return (
    <g
      onClick={() => clickable && onNodeClick(payload)}
      onMouseEnter={() => clickable && onNodeHover(payload.key)}
      onMouseLeave={() => clickable && onNodeHover(null)}
      className={clickable ? "cursor-pointer" : ""}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        fill={payload.color}
        fillOpacity={hovered ? 0.82 : 1}
        stroke={hovered ? "#f8fafc" : "#ffffff"}
        strokeWidth={hovered ? 3 : 1}
        filter={hovered ? "drop-shadow(0 0 5px rgba(15, 23, 42, 0.22))" : undefined}
      />
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

function StudentListModal({ selectedNode, onClose, onStudentNavigate }) {
  useEffect(() => {
    if (!selectedNode) return

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedNode, onClose])

  if (!selectedNode) return null
  const isCluster = selectedNode.type === "cluster"
  const subtitle = isCluster
    ? "Behavioural cluster identified by unsupervised model"
    : "Supervised class membership with KMeans cluster placement."

  function handleStudentOpen(studentId) {
    if (!studentId) return
    onClose()
    if (typeof onStudentNavigate === "function") {
      onStudentNavigate(studentId)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl border border-gray-100 shadow-xl flex flex-col" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${selectedNode.label} students`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-[#1a1a2e]">{selectedNode.label} - {selectedNode.students.length} Students</h3>
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100" aria-label="Close student list modal">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto space-y-2">
          {selectedNode.students.length === 0 ? (
            <p className="text-sm text-gray-500">No students found for this class.</p>
          ) : selectedNode.students.map((student) => {
            const disagreesWithDominant = isCluster
              && selectedNode.dominantClass
              && student.supervisedClass !== selectedNode.dominantClass

            return (
              <button
                key={`${selectedNode.label}-${student.studentId}`}
                type="button"
                onClick={() => handleStudentOpen(student.studentId)}
                className="w-full text-left rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 hover:bg-white hover:border-[#ff4b2b]/30 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-[#1a1a2e] truncate">{student.studentName}</p>
                    <p className="text-xs text-gray-400 truncate">{student.studentEmail || student.studentId || "Student ID unavailable"}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap justify-end text-xs font-semibold">
                    <span className="text-gray-600">{formatScore(student.score)}</span>
                    <span className="text-gray-600">{formatTime(student.timeTaken)}</span>
                    {isCluster ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-orange-700">
                        <span className="h-2 w-2 rounded-full bg-orange-500" />
                        {student.supervisedClass || "Unclassified"}
                        {disagreesWithDominant && (
                          <span title="Preset class may not reflect actual behaviour" className="text-amber-600">
                            <AlertTriangle size={13} />
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        {student.kmeanCluster != null ? `Cluster ${student.kmeanCluster}` : "Cluster unavailable"}
                      </span>
                    )}
                    <span className="text-[#ff4b2b]">View Profile -&gt;</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function ClusterMetricCard({ cluster, color, expanded, onToggle, onViewStudents }) {
  const metrics = useMemo(() => computeClusterMetrics(cluster), [cluster])
  const [minScore, maxScore] = metrics.scoreRange

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-stretch gap-0 hover:bg-gray-50 transition"
      >
        <span className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
        <div className="flex-1 px-4 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h5 className="font-bold text-[#1a1a2e]">{cluster.label}</h5>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700">
                Mostly: {metrics.dominantSupClass}
                {metrics.isMixed && <span className="h-2 w-2 rounded-full bg-amber-500" title={metrics.mixedWarning} />}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {metrics.studentCount} students · Avg score {metrics.avgScore}% · {metrics.timeLabel} responders
            </p>
          </div>
          <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          <div>
            <h6 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Performance</h6>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MetricPill label="Average Score" value={`${metrics.avgScore}%`} />
              <MetricPill label="Score Range" value={`${minScore}% - ${maxScore}%`} />
              <MetricPill label="Support Split" value={`${metrics.highPerformers} high · ${metrics.strugglingStudents} need support`} />
            </div>
            <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, metrics.avgScore))}%`, backgroundColor: color }} />
            </div>
          </div>

          <div>
            <h6 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Exam Behaviour</h6>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MetricPill label="Average completion time" value={`${formatMinutes(metrics.avgTimeTaken)} (${metrics.timeLabel})`} />
              <MetricPill label="Score consistency" value={metrics.consistencyLabel} />
            </div>
            <p className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
              {metrics.behaviourSummary}
            </p>
          </div>

          <div>
            <h6 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Preset Class Alignment</h6>
            <p className="text-sm font-semibold text-[#1a1a2e]">
              Behavioural model match: {metrics.dominantSupClass} ({metrics.dominantSupClassPct}%)
            </p>
            {metrics.isMixed ? (
              <p className="mt-2 inline-flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                {metrics.mixedWarning}
              </p>
            ) : (
              <p className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                Strong alignment with preset class - model is consistent for this group
              </p>
            )}
          </div>

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onViewStudents}
              className="px-4 py-2 rounded-xl bg-[#1a1a2e] text-white text-sm font-semibold hover:bg-[#252542] transition"
            >
              View {metrics.studentCount} Students -&gt;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricPill({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-sm font-bold text-[#1a1a2e] mt-0.5">{value}</p>
    </div>
  )
}

export default function SankeyBridgeChart({ attempts, viewMode = "combined", onStudentNavigate }) {
  const bridge = useMemo(() => buildSankeyBridgeData(attempts), [attempts])
  const [selectedNode, setSelectedNode] = useState(null)
  const [hoveredNodeKey, setHoveredNodeKey] = useState(null)
  const [expandedClusterKey, setExpandedClusterKey] = useState(null)
  const showSupervised = viewMode !== "clusters"
  const showClusters = viewMode !== "supervised"
  const canShowSupervised = showSupervised && (bridge.hasSupervised || !bridge.hasClusters)
  const canShowClusters = showClusters && (bridge.hasClusters || !bridge.hasSupervised)
  const showCombined = viewMode === "combined" && bridge.hasSupervised && bridge.hasClusters && bridge.links.length > 0
  const clusterCards = useMemo(
    () => [...bridge.clusters].sort((a, b) => b.students.length - a.students.length),
    [bridge.clusters]
  )

  if (!attempts?.length) {
    return <p className="text-sm text-gray-500">No analytics data available for this exam.</p>
  }

  function openNode(node) {
    if ((node.type !== "class" && node.type !== "cluster") || !node.students?.length) return
    setSelectedNode({
      type: node.type === "cluster" ? "cluster" : "supervised",
      label: node.classLabel || node.label,
      clusterId: node.clusterId,
      dominantClass: node.dominantClass,
      students: node.students,
    })
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
              node={(props) => (
                <SankeyNode
                  {...props}
                  hoveredNodeKey={hoveredNodeKey}
                  onNodeHover={setHoveredNodeKey}
                  onNodeClick={openNode}
                />
              )}
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
      ) : viewMode === "clusters" ? (
        <div className="space-y-3">
          {clusterCards.map((cluster, index) => (
            <ClusterMetricCard
              key={cluster.key}
              cluster={cluster}
              color={CLUSTER_COLORS[index % CLUSTER_COLORS.length]}
              expanded={expandedClusterKey === cluster.key}
              onToggle={() => setExpandedClusterKey((current) => current === cluster.key ? null : cluster.key)}
              onViewStudents={() => openNode({
                type: "cluster",
                label: cluster.label,
                clusterId: cluster.value,
                dominantClass: bridge.dominantClassByCluster[cluster.key],
                students: cluster.students,
              })}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {canShowSupervised && bridge.classes.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => item.students.length > 0 && openNode({
                type: "class",
                classLabel: item.label,
                label: item.label,
                students: item.students,
              })}
              className={`text-left rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 ${item.students.length > 0 ? "cursor-pointer hover:bg-white hover:border-[#ff4b2b]/30 hover:shadow-sm" : "cursor-default"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-[#1a1a2e]">{item.label}</span>
                <span className="text-xs font-bold" style={{ color: CLASS_COLORS[index % CLASS_COLORS.length] }}>{item.count}</span>
              </div>
            </button>
          ))}
          {canShowClusters && bridge.clusters.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onClick={() => item.students.length > 0 && openNode({
                type: "cluster",
                label: item.label,
                clusterId: item.value,
                dominantClass: bridge.dominantClassByCluster[item.key],
                students: item.students,
              })}
              className={`text-left rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 ${item.students.length > 0 ? "cursor-pointer hover:bg-white hover:border-[#ff4b2b]/30 hover:shadow-sm" : "cursor-default"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-[#1a1a2e]">{item.label}</span>
                <span className="text-xs font-bold" style={{ color: CLUSTER_COLORS[index % CLUSTER_COLORS.length] }}>{item.count}</span>
              </div>
            </button>
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

      <StudentListModal
        selectedNode={selectedNode}
        onClose={() => setSelectedNode(null)}
        onStudentNavigate={onStudentNavigate}
      />
    </div>
  )
}
