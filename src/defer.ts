export default class Defer {
	private promise: Promise<void> = Promise.resolve()
	private reject: (reason?: any) => void
	timeout: any

	constructor(private cb?: () => Promise<void>) {}

	defer(cb?: () => Promise<void>) {
		if (cb) this.cb = cb
		if (!this.timeout) {
			let resolver: (value?: any) => void
			this.promise = new Promise<void>((resolve, reject) => {
				resolver = resolve
				this.reject = reject
			})
			this.timeout = setTimeout(async () => {
				if (this.cb) await this.cb()
				this.timeout = undefined
				resolver()
			})
		}
		return this.promise
	}

	get deferring() {
		return !!this.timeout
	}

	cancel() {
		if (!this.timeout) return
		clearTimeout(this.timeout)
		this.reject()
		this.timeout = undefined
	}
}
