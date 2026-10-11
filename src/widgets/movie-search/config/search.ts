export type SearchMode = "text" | "image" | "video" | "audio";

export const searchModes: { id: SearchMode; label: string; hint: string }[] = [
  { id: "text", label: "Текст", hint: "Опиши сцену словами" },
  { id: "image", label: "Изображение", hint: "Кадр или скриншот" },
  { id: "video", label: "Видео", hint: "Фрагмент до 30 секунд" },
  { id: "audio", label: "Аудио", hint: "Звук до 10 секунд" },
];
