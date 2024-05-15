import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-typescript2'
import pluginDts from 'rollup-plugin-dts'
import shim from 'rollup-plugin-shim'
import { rm } from 'node:fs/promises'

// clean out the destination folder
await rm('lib', { recursive: true, force: true })

export default [
	{
		input: ['src/index.ts', 'src/client.ts'],
		output: {
			dir: 'lib'
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
			pluginDts()
		]
	},
	{
		input: ['src/index.ts', 'src/client.ts'],
		output: {
			dir: 'lib/cjs',
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
		input: ['src/index.ts', 'src/client.ts'],
		output: {
			dir: 'lib/esm',
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
	},
	{
		input: 'src/client.ts',
		output: {
			file: 'lib/omni18n.js',
			sourcemap: true,
			format: 'umd',
			name: 'OmnI18n'
		},
		plugins: [
			shim({
				os: 'module.export = {}'
			}),
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
