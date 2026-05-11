interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = '1rem', radius = '4px', style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
    />
  );
}

export function SkeletonText({ lines = 1, lastWidth = '100%' }: { lines?: number; lastWidth?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height=".85rem" width={i === lines - 1 ? lastWidth : '100%'} />
      ))}
    </div>
  );
}

export function SkeletonTableRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} style={{ padding: '.75rem .85rem' }}>
          <Skeleton height=".85rem" width={i === 0 ? '70%' : i % 2 === 0 ? '50%' : '60%'} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }, (_, i) => (
              <th key={i}><Skeleton height=".65rem" width={`${50 + (i * 10) % 30}%`} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <SkeletonTableRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card">
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Skeleton height="1.1rem" width="40%" />
        <Skeleton height=".85rem" width="70%" />
        <Skeleton height=".85rem" width="55%" />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="card">
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
        <Skeleton height=".7rem" width="50%" />
        <Skeleton height="1.8rem" width="40%" />
      </div>
    </div>
  );
}
