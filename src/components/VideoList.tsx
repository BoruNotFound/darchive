import type { Guest, Video } from "@/types";
import { VideoCard } from "./VideoCard";

interface VideoListProps {
  videos: Video[];
  guestsById: Map<string, Guest>;
}

export function VideoList({ videos, guestsById }: VideoListProps) {
  if (videos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
        没有匹配的视频。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} guestsById={guestsById} />
      ))}
    </div>
  );
}
