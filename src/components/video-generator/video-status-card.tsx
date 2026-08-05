"use client";

import { cn } from "@/components/ui";
import { getVideoProgress } from "@/lib/video-progress";

interface VideoStatusCardProps {
  status: string;
  videoUrl?: string;
  error?: string;
  progress?: number;
}

export function VideoStatusCard({
  status,
  videoUrl,
  error,
  progress,
}: VideoStatusCardProps) {
  const statusConfig = {
    PENDING: { label: "Pending", color: "text-yellow-500", bg: "bg-yellow-500/10" },
    GENERATING: { label: "Generating", color: "text-blue-500", bg: "bg-blue-500/10" },
    UPLOADING: { label: "Uploading", color: "text-purple-500", bg: "bg-purple-500/10" },
    COMPLETED: { label: "Completed", color: "text-green-500", bg: "bg-green-500/10" },
    FAILED: { label: "Failed", color: "text-red-500", bg: "bg-red-500/10" },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
  const displayProgress = getVideoProgress(status, progress);

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-card rounded-xl border">
      <div className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Generation Status</h3>
          <span
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium",
              config.bg,
              config.color
            )}
          >
            {config.label}
          </span>
        </div>

        {/* Progress Indicator */}
        {(status === "PENDING" || status === "GENERATING" || status === "UPLOADING") && (
          <div className="space-y-2">
            <div
              role="progressbar"
              aria-label={`${config.label} ${displayProgress}%`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={displayProgress}
              tabIndex={0}
              className="h-2 bg-muted rounded-full overflow-hidden"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  status === "PENDING" && "bg-yellow-500",
                  status === "GENERATING" && "bg-blue-500",
                  status === "UPLOADING" && "bg-purple-500"
                )}
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <p>
                {status === "PENDING" && "Waiting in queue..."}
                {status === "GENERATING" && "AI is generating your video..."}
                {status === "UPLOADING" && "Uploading to storage..."}
              </p>
              <span className="font-semibold tabular-nums text-foreground">
                {displayProgress}%
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {status === "FAILED" && error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Video Player */}
        {status === "COMPLETED" && videoUrl && (
          <div className="space-y-3">
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg bg-black"
              autoPlay
              loop
            />
            <div className="flex gap-2">
              <a
                href={videoUrl}
                download
                className="flex-1 py-2 text-center text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Download Video
              </a>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(videoUrl)}
                className="px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors"
              >
                Copy URL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
