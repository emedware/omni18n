export default class Defer {
	private promise: Promise<void> = Promise.resolve()
	private rejecter?: (reason?: any) => void
	private resolver?: (value?: any) => void
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
			this.promise = new Promise<void>((resolve, reject) => {
				this.resolver = resolve
				this.rejecter = reject
			})
			this.internalCB = async () => {
				this.timeout = undefined
				if (this.cb) await this.cb()
				this.resolver!()
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
		this.rejecter!('`Defer`red action canceled')
		this.timeout = undefined
	}

	resolve() {
		if (this.timeout) this.internalCB?.()
		return this.promise
	}
}
