import { Route, Routes } from "react-router-dom";
import { Dashboard } from "@/pages/Dashboard";
import { AdminPage } from "@/pages/AdminPage";
import { GuestsPage } from "@/pages/GuestsPage";
import { VideosPage } from "@/pages/VideosPage";
import { AuditLogPage } from "@/pages/AuditLogPage";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/guests" element={<GuestsPage />} />
        <Route path="/admin/videos" element={<VideosPage />} />
        <Route path="/admin/audit-log" element={<AuditLogPage />} />
      </Routes>
    </div>
  );
}
