import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import CapturePage from './pages/CapturePage';
import ClassesPage from './pages/ClassesPage';
import EditorPage from './pages/EditorPage';
import HandPage from './pages/HandPage';
import LecturePage from './pages/LecturePage';
import LecturesPage from './pages/LecturesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClassesPage />} />
        <Route path="/classes/:classId" element={<LecturesPage />} />
        <Route path="/lectures/:lectureId" element={<LecturePage />} />
        <Route path="/lectures/:lectureId/capture" element={<CapturePage />} />
        <Route path="/lectures/:lectureId/slides/:slideId" element={<EditorPage />} />
        <Route path="/handwriting" element={<HandPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
