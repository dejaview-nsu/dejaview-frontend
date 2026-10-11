import { type FileSearchMode } from "@/shared/api";
import { type FileConstraints } from "@/shared/lib/files";

export const fileConstraints: Record<FileSearchMode, FileConstraints> = {
  image: {
    kind: "image",
    extensions: ["jpg", "jpeg", "png", "webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 10 * 1024 * 1024,
  },
  video: {
    kind: "video",
    extensions: ["mp4", "mov", "webm"],
    mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    maxBytes: 50 * 1024 * 1024,
    maxDurationSeconds: 30,
  },
};
