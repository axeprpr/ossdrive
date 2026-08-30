package main

import "testing"

func TestFilterSortPage(t *testing.T) {
	source := []listItem{
		{Name: "folder", Kind: "folder"},
		{Name: "b.txt", Kind: "file", Size: 20, Modified: "2026-01-02T00:00:00Z"},
		{Name: "a.txt", Kind: "file", Size: 10, Modified: "2026-01-01T00:00:00Z"},
	}

	items, total := filterSortPage(source, ".txt", "size", "desc", 1, 10)
	if total != 2 || len(items) != 2 || items[0].Name != "b.txt" {
		t.Fatalf("unexpected filtered result: total=%d items=%+v", total, items)
	}

	items, total = filterSortPage(source, "", "name", "asc", 2, 2)
	if total != 3 || len(items) != 1 || items[0].Name != "b.txt" {
		t.Fatalf("unexpected page result: total=%d items=%+v", total, items)
	}
}
