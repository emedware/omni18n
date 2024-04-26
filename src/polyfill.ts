if (!Set.prototype.union)
	Object.defineProperty(Set.prototype, 'union', {
		value<T>(this: Set<T>, ...sets: Set<T>[]) {
			const result = new Set<T>(this)
			for (const set of sets) for (const value of set) result.add(value)
			return result
		}
	})
