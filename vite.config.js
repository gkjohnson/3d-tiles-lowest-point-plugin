import { searchForWorkspaceRoot, loadEnv, optimizeDeps } from 'vite';
import fs from 'fs';
import react from '@vitejs/plugin-react';

export default ( { mode } ) => {

	process.env = { ...process.env, ...loadEnv( mode, process.cwd() ) };

	return {

		root: './example/',
		envDir: '.',
		base: '',
		build: {
			outDir: './bundle/',
			rollupOptions: {
				input: [
					...fs.readdirSync( './example/' ),
				]
					.filter( p => /\.html$/.test( p ) )
					.map( p => `./example/${ p }` ),
			},
		},
		optimizeDeps: {
			exclude: [ '3d-tiles-renderer' ],
		},
		server: {
			fs: {
				allow: [
					// search up for workspace root
					searchForWorkspaceRoot( process.cwd() ),
				],
			},
		},
		plugins: [ react() ],
	};

};
