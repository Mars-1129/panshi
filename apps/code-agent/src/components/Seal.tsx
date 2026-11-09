import { useId } from "react"

/** 契约印章：交付页与契约页的唯一“仪式感”元素，只表达已锁定的事实。 */
export function Seal(props: { hash: string; version?: number; lockedAt?: string | null; size?: number }) {
  const rawId = useId().replace(/[:]/g, "")
  const arcId = `seal-arc-${rawId}`
  const size = props.size ?? 112
  const date = props.lockedAt ? new Date(props.lockedAt) : null
  const stampDate = date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "—"

  return <div className="contract-seal" style={{ width: size, height: size }} role="img" aria-label={`契约 v${props.version ?? 1} 已锁定`}>
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle className="seal-ring" cx="60" cy="60" r="56" />
      <circle className="seal-ring-inner" cx="60" cy="60" r="49" />
      <path id={arcId} d="M 22 60 A 38 38 0 0 1 98 60" fill="none" />
      <text className="seal-arc-text">
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">PANSHI · CONTRACT</textPath>
      </text>
    </svg>
    <div className="seal-body">
      <b>契约 v{props.version ?? 1}</b>
      <span>已锁定</span>
      <code>{props.hash.slice(0, 8)}</code>
      <em>{stampDate}</em>
    </div>
  </div>
}
