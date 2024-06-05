import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-typescript2'

export default {
	input: 'src/umd/extractLocales.ts',
	output: {
		banner: '/** https://www.npmjs.com/package/omni18n */',
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
