import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-typescript2'

export default {
	input: 'src/umd/extractLocales.ts',
	output: {
		file: 'bin/extractLocales.mjs'
	},
	plugins: [
		resolve(),
		commonjs(),
		typescript({
			tsconfigOverride: {
				include: ['./src'],
				exclude: ['./node_modules']
			}
		})
	]
}
