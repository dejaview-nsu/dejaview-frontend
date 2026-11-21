const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

export const formatDate = (value: string) => dateFormatter.format(new Date(value));
