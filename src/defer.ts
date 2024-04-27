export default class Defer {
	private promise: Promise<void> = Promise.resolve()
	private reject?: (reason?: any) => void
	timeout: any
	private internalCB?: () => Promise<void>

	constructor(
		private cb?: () => Promise<void>,
		public delay: number = 0
	) {}

	defer(cb?: () => Promise<void>) {
		if (cb) this.cb = cb
		if (this.timeout) clearTimeout(this.timeout)
		else {
			let resolver: (value?: any) => void
			this.promise = new Promise<void>((resolve, reject) => {
				resolver = resolve
				this.reject = reject
			})
			this.internalCB = async () => {
				if (this.cb) await this.cb()
				this.timeout = undefined
				resolver()
			}
		}
		this.timeout = setTimeout(this.internalCB!, this.delay)
		return this.promise
	}

	get deferring() {
		return !!this.timeout
	}

	cancel() {
		if (!this.timeout) return
		clearTimeout(this.timeout)
		this.reject!()
		this.timeout = undefined
	}
}
