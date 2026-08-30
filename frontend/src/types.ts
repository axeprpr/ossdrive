export type SortKey = "name" | "size" | "modified";
export type SortDirection = "asc" | "desc";

export type DriveItem = {
  name: string;
  kind: "file" | "folder";
  size: number;
  modified: string;
};

export type Listing = {
  items: DriveItem[];
  total: number;
  usage: number;
  page: number;
  page_size: number;
};

export type PreviewData = {
  name: string;
  url: string;
  text?: string;
};
