export function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(" "); }
export function formatSize(value: number) { const units = ["B", "KB", "MB", "GB", "TB"]; let i = 0; while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; } return `${value.toFixed(i ? 1 : 0)} ${units[i]}`; }
