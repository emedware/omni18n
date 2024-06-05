import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-typescript2'
import pluginDts from 'rollup-plugin-dts'
import { rm } from 'node:fs/promises'
import terser from '@rollup/plugin-terser'
import umd from './rollup.umd.js'
import extract from './rollup.extract.js'

// clean out the destination folder
await rm('lib', { recursive: true, force: true })
await rm('bin', { recursive: true, force: true })
umd.plugins.push(terser())

export default [
	{
		input: ['src/index.ts', 'src/s-a.ts', 'src/client.ts'],
		output: {
			banner: '/** https://www.npmjs.com/package/omni18n */',
			dir: 'lib'
		},
		external: ['json5'],
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
		input: ['src/index.ts', 'src/s-a.ts', 'src/client.ts'],
		output: {
			banner: '/** https://www.npmjs.com/package/omni18n */',
			dir: 'lib/cjs',
			sourcemap: true,
			format: 'cjs',
			exports: 'named'
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
	},
	{
		input: ['src/index.ts', 'src/s-a.ts', 'src/client.ts'],
		output: {
			banner: '/** https://www.npmjs.com/package/omni18n */',
			dir: 'lib/esm',
			sourcemap: true,
			format: 'esm'
		},
		external: ['json5'],
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
	umd,
	extract
]
