export function Spinner({ size = 'md', light = false }: { size?: 'sm' | 'md' | 'lg'; light?: boolean }) {
  const cls = `spinner${size === 'lg' ? ' spinner-lg' : ''}`;
  return <div className={cls} style={light ? { borderTopColor: '#fff' } : undefined} />;
}

export function PageSpinner() {
  return (
    <div className="spinner-center">
      <Spinner size="lg" />
    </div>
  );
}
