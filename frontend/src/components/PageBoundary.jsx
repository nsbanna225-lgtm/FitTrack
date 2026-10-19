import { Component } from 'react';
export default class PageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="error-page"><h1>Unable to open this page.</h1><p role="alert">Please reload and sign in again. Unsaved changes may be lost.</p><a className="primary-button" href="/">Reload FitTrack</a></main>;
    return this.props.children;
  }
}
