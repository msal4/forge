// Package rank implements lexicographic fractional indexing for ordering
// Kanban issues within a status column. Ranks are plain strings compared
// bytewise; to insert an item between two neighbors we generate a new rank
// string that sorts strictly between their ranks, so reordering never requires
// rewriting other rows.
package rank

import "errors"

// digits is the rank alphabet. It is ASCII-ascending so Go's native string
// comparison (`<`) matches the intended ordering, and it is dense enough that
// midpoints between adjacent ranks can always be found by extending the string.
const digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

const base = len(digits)

// digitVal returns the alphabet index of s[i], or def when i is past the end of
// s (used to supply a virtual bound: 0 for a lower bound, base for an upper one).
func digitVal(s string, i, def int) int {
	if i >= len(s) {
		return def
	}
	// digits are contiguous ranges; index by scanning is avoided via a map-free
	// arithmetic decode below.
	c := s[i]
	switch {
	case c >= '0' && c <= '9':
		return int(c - '0')
	case c >= 'A' && c <= 'Z':
		return int(c-'A') + 10
	case c >= 'a' && c <= 'z':
		return int(c-'a') + 36
	default:
		// Unknown byte: treat as the requested default bound. Shouldn't happen
		// for ranks we generate, but keeps Between total.
		return def
	}
}

// Between returns a rank string r such that prev < r < next under bytewise
// string comparison. An empty prev means "no lower bound" (insert at the top);
// an empty next means "no upper bound" (insert at the bottom / append). It
// returns an error only when prev >= next (callers pass well-ordered bounds).
func Between(prev, next string) (string, error) {
	if prev != "" && next != "" && prev >= next {
		return "", errors.New("rank: prev must be less than next")
	}

	// Both unbounded: pick a middle character with room to grow on either side.
	if prev == "" && next == "" {
		return string(digits[base/2]), nil
	}

	var out []byte
	for i := 0; ; i++ {
		// Lower bound digit: 0 once prev is exhausted.
		a := digitVal(prev, i, 0)
		// Upper bound digit: base (one past max) once next is unbounded/exhausted.
		b := base
		if next != "" {
			b = digitVal(next, i, base)
		}

		if a == b {
			// No room here; copy the shared digit and descend.
			out = append(out, digits[a])
			continue
		}

		mid := (a + b) / 2
		if mid != a {
			// Real gap: emit the midpoint digit and we're done.
			out = append(out, digits[mid])
			return string(out), nil
		}

		// Adjacent digits (b == a+1): keep prev's digit and continue, treating
		// next as unbounded from here so we descend into prev's tail and land
		// strictly above it.
		out = append(out, digits[a])
		next = ""
	}
}
