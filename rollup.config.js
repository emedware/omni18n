import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-typescript2'
import json from '@rollup/plugin-json'

export default {
	input: './src/index.ts',
	output: {
		file: 'dist/index.js',
		format: 'cjs'
	},
	external: ['hjson'],
	plugins: [
		resolve(),
		commonjs(),
		typescript({
			tsconfigOverride: {
				include: ['./src'],
				exclude: ['./node_modules']
			}
		}),
		json()
	]
}
