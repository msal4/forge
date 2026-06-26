package rank

import (
	"sort"
	"testing"
)

func mustBetween(t *testing.T, prev, next string) string {
	t.Helper()
	r, err := Between(prev, next)
	if err != nil {
		t.Fatalf("Between(%q, %q) returned error: %v", prev, next, err)
	}
	if prev != "" && !(prev < r) {
		t.Fatalf("Between(%q, %q) = %q; want prev < r", prev, next, r)
	}
	if next != "" && !(r < next) {
		t.Fatalf("Between(%q, %q) = %q; want r < next", prev, next, r)
	}
	return r
}

func TestBetweenBounds(t *testing.T) {
	// Both unbounded.
	mustBetween(t, "", "")
	// Top (no lower bound).
	mustBetween(t, "", "V")
	// Bottom (no upper bound).
	mustBetween(t, "V", "")
	// Wide gap.
	mustBetween(t, "A", "z")
	// Adjacent single digits.
	mustBetween(t, "0", "1")
	// Adjacent multi-char (forces descent into prev's tail).
	mustBetween(t, "00", "01")
	// Zero-padded neighbors like the backfill migration produces.
	mustBetween(t, "000001", "000002")
}

func TestBetweenRejectsBadOrder(t *testing.T) {
	if _, err := Between("b", "a"); err == nil {
		t.Fatal("Between(\"b\", \"a\") = nil error; want error")
	}
	if _, err := Between("a", "a"); err == nil {
		t.Fatal("Between(\"a\", \"a\") = nil error; want error")
	}
}

// TestSequentialInserts repeatedly inserts at the front, back, and middle and
// asserts the full set stays strictly ordered and unique.
func TestSequentialInserts(t *testing.T) {
	ranks := []string{mustBetween(t, "", "")}

	for i := 0; i < 1000; i++ {
		switch i % 3 {
		case 0: // insert at front
			r := mustBetween(t, "", ranks[0])
			ranks = append([]string{r}, ranks...)
		case 1: // insert at back
			r := mustBetween(t, ranks[len(ranks)-1], "")
			ranks = append(ranks, r)
		default: // insert in the middle
			mid := len(ranks) / 2
			r := mustBetween(t, ranks[mid-1], ranks[mid])
			ranks = append(ranks[:mid], append([]string{r}, ranks[mid:]...)...)
		}
	}

	if !sort.StringsAreSorted(ranks) {
		t.Fatal("ranks are not sorted after sequential inserts")
	}
	seen := make(map[string]bool, len(ranks))
	for _, r := range ranks {
		if seen[r] {
			t.Fatalf("duplicate rank generated: %q", r)
		}
		seen[r] = true
	}
}
