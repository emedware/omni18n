import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-typescript2'

export default {
	input: 'src/umd/client.ts',
	output: {
		banner: '/** https://www.npmjs.com/package/omni18n */',
		file: 'lib/omni18n.js',
		format: 'umd',
		name: 'OmnI18n'
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
