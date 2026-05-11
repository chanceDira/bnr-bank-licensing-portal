export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <div className={`spinner${size === 'lg' ? ' spinner-lg' : ''}`} />;
}

export function PageSpinner() {
  return <div className="spinner-center"><Spinner size="lg" /></div>;
}
