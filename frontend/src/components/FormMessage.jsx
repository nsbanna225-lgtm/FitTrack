export default function FormMessage({ children, success = false }) {
  if (!children) return null;
  return <div className={`form-message ${success ? 'success' : 'error'}`} role={success ? 'status' : 'alert'}>{children}</div>;
}
