import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-typescript2'
import { rm } from 'node:fs/promises'

// clean out the destination folder
await rm('lib', { recursive: true, force: true })

export default [
	{
		input: './src/client.ts',
		output: {
			file: 'lib/client.js',
			sourcemap: true,
			format: 'cjs',
			exports: 'named'
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
		input: './src/client.ts',
		output: {
			file: 'lib/client.esm.js',
			sourcemap: true,
			format: 'esm',
			exports: 'named'
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
			file: 'lib/server.js',
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
			file: 'lib/server.esm.js',
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
