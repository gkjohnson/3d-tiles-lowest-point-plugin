import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BoxGeometry, MathUtils } from 'three';
// TilesRenderer, controls and attribution imports
import {
	TilesPlugin,
	TilesRenderer,
	EastNorthUpFrame,
} from '3d-tiles-renderer/r3f';

// Plugins
import {
	CesiumIonAuthPlugin,
	GLTFExtensionsPlugin,
} from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

//

import { TileFlatteningPlugin, TileFlatteningShape } from '../src/r3f/TileFlatteningPlugin.jsx';
import { ReorientationPlugin } from '../src/three/ReorientationPlugin.js';

const dracoLoader = new DRACOLoader().setDecoderPath( 'https://www.gstatic.com/draco/v1/decoders/' );
const LAT = 35.6586 * MathUtils.DEG2RAD;
const LON = 139.7454 * MathUtils.DEG2RAD;

function Tree( props ) {

	const green = 0x66bb44;
	const brown = 0xaa4422;
	return (
		<group { ...props }>
			<mesh scale={ [ 0.1, 1, 0.1 ] } position-y={ 0.5 }>
				<cylinderGeometry />
				<meshStandardMaterial color={ brown } />
			</mesh>
			<mesh position-y={ 1 }>
				<coneGeometry />
				<meshStandardMaterial color={ green } />
			</mesh>
			<mesh position-y={ 1.35 } scale={ 0.8 }>
				<coneGeometry />
				<meshStandardMaterial color={ green } />
			</mesh>
			<mesh position-y={ 1.7 } scale={ 0.6 }>
				<coneGeometry />
				<meshStandardMaterial color={ green } />
			</mesh>
		</group>
	);

}

function App() {

	const treePositions = useMemo( () => {

		return new Array( 100 ).fill().map( c => {

			return [ ( Math.random() - 0.5 ) * 500, 0, ( Math.random() - 0.5 ) * 500 ];

		} );

	}, [] );

	const [ height, setHeight ] = useState( 50 );
	useEffect( () => {

		setTimeout( () => {

			// setHeight( - 20 );

		}, 5000 );

	} );

	// console.log('HERE' , height)

	return (
		<Canvas
			frameloop='demand'
			camera={ {
				position: [ 0, 1e3, 1e3 ],
				near: 1,
				far: 1e5,
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
			<ambientLight />
			<directionalLight position={ [ 1, 2, 3 ] } />

			{
				treePositions.map( ( pos, i ) => {

					return <Tree scale={ 15 } position={ pos } key={ i } />

				} )
			}

			<TilesRenderer group={ { rotation: [ - Math.PI / 2, 0, 0 ] } }>
				<TilesPlugin plugin={ CesiumIonAuthPlugin } args={ { apiToken: import.meta.env.VITE_ION_KEY, assetId: '2275207', autoRefreshToken: true } } />
				<TilesPlugin plugin={ GLTFExtensionsPlugin } dracoLoader={ dracoLoader } />
				<TilesPlugin plugin={ ReorientationPlugin } lat={ LAT } lon={ LON } height={ height } key={ height } />

				<TileFlatteningPlugin>
					<TileFlatteningShape relativeToEllipsoid visible>
						<EastNorthUpFrame lat={ LAT } lon={ LON } height={ height }>
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

