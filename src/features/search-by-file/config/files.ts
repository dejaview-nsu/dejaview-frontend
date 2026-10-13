import { type ImageConstraints } from "@/shared/lib/files";

export const fileConstraints: { image: ImageConstraints } = {
  image: {
    kind: "image",
    extensions: ["jpg", "jpeg", "png", "webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 10 * 1024 * 1024,
  },
};
