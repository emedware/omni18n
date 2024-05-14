import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-typescript2'

export default [
	{
		input: './src/index.ts',
		output: {
			file: 'dist/index.js',
			sourcemap: true,
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
			})
		]
	},
	{
		input: './src/index.ts',
		output: {
			file: 'dist/index.esm.js',
			sourcemap: true,
			format: 'esm'
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
			})
		]
	}
]
