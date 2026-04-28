import { Route, Routes } from "react-router-dom";
import { Dashboard } from "@/pages/Dashboard";
import { AdminPage } from "@/pages/AdminPage";
import { GuestsPage } from "@/pages/GuestsPage";
import { VideosPage } from "@/pages/VideosPage";
import { VideosMissingGuestsPage } from "@/pages/VideosMissingGuestsPage";
import { AuditLogPage } from "@/pages/AuditLogPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/guests" element={<GuestsPage />} />
        <Route path="/admin/videos" element={<VideosPage />} />
        <Route
          path="/admin/videos-missing-guests"
          element={<VideosMissingGuestsPage />}
        />
        <Route path="/admin/audit-log" element={<AuditLogPage />} />
      </Routes>
    </div>
  );
}
