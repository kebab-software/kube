import React from 'react';
import { createRoot } from 'react-dom/client';
import { loadLibrary } from './storage';
import { AppProvider } from './context';
import { App } from './App';
import './styles.css';
class Boundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <main className="fatal"><h1>Kube couldn’t display this screen.</h1><p>Your saved library has been kept.</p><button onClick={() => location.reload()}>Reload app</button></main> : this.props.children; }
}
const { library, warning } = await loadLibrary();
createRoot(document.getElementById('root')!).render(<Boundary><AppProvider initial={library} warning={warning}><App /></AppProvider></Boundary>);
