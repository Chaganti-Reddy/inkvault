import { Routes, Route, Navigate } from 'react-router-dom';
import { PdfProvider } from './context/PdfContext.jsx';
import TopBar from './components/TopBar.jsx';
import Toaster from './components/Toaster.jsx';
import Home from './pages/Home.jsx';
import Editor from './pages/Editor.jsx';
import './App.css';

export default function App() {
  return (
    <PdfProvider>
      <div className="app">
        <TopBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/edit" element={<Editor />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Toaster />
    </PdfProvider>
  );
}
