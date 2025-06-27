import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MathUtils } from 'three';
// TilesRenderer, controls and attribution imports
import {
	TilesPlugin,
	TilesRenderer,
	GlobeControls,
	EastNorthUpFrame,
} from '3d-tiles-renderer/r3f';

// Plugins
import {
	CesiumIonAuthPlugin,
	GLTFExtensionsPlugin,
	ReorientationPlugin,
} from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

//

import { TileFlatteningPlugin, TileFlatteningShape } from '../src/r3f/TileFlatteningPlugin.jsx';

const dracoLoader = new DRACOLoader().setDecoderPath( 'https://www.gstatic.com/draco/v1/decoders/' );
const LAT = 35.6586 * MathUtils.DEG2RAD;
const LON = 139.7454 * MathUtils.DEG2RAD;

function App() {

	return (
		<Canvas
			frameloop='demand'
			camera={ {
				position: [ 0, 1e3, 1e3 ],
				near: 1,
				far: 1e6,
			} }
			style={ {
				width: '100%',
				height: '100%',
				position: 'absolute',
				margin: 0,
				left: 0,
				top: 0,
			} }
			flat
		>
			<color attach="background" args={ [ 0x111111 ] } />

			<TilesRenderer group={ { rotation: [ - Math.PI / 2, 0, 0 ] } }>
				<TilesPlugin plugin={ CesiumIonAuthPlugin } args={ { apiToken: import.meta.env.VITE_ION_KEY, assetId: '2275207', autoRefreshToken: true } } />
				<TilesPlugin plugin={ GLTFExtensionsPlugin } dracoLoader={ dracoLoader } />
				<TilesPlugin plugin={ ReorientationPlugin } lat={ LAT } lon={ LON } />

				{/*
					TODO:
					- Fix the flattening plugin to work every frame
					- Fix the flattening plug int work if the ENU frame is wrapped outside
				*/}
				<TileFlatteningPlugin>
					<TileFlatteningShape relativeToEllipsoid>
						<EastNorthUpFrame lat={ LAT } lon={ LON } height={ - 20 }>
							<mesh scale={ 500 }>
								<planeGeometry />
							</mesh>
						</EastNorthUpFrame>
					</TileFlatteningShape>
				</TileFlatteningPlugin>


				{/* Controls */}
				<OrbitControls />

			</TilesRenderer>
		</Canvas>
	);

}

createRoot( document.getElementById( 'root' ) ).render(
	<StrictMode>
		<App />
	</StrictMode>,
);

