import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import RouteAnnouncer from './components/RouteAnnouncer.jsx';
import AppRoutes from './routes/AppRoutes.jsx';

export default function App() {
  return <BrowserRouter><AuthProvider><RouteAnnouncer /><AppRoutes /></AuthProvider></BrowserRouter>;
}
