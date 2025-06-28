import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BoxGeometry, MathUtils, SphereGeometry } from 'three';

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
	TileCompressionPlugin,
	TilesFadePlugin,
} from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

//

import { TileFlatteningPlugin, TileFlatteningShape } from '../src/r3f/TileFlatteningPlugin.jsx';
import { ReorientationPlugin } from '../src/three/ReorientationPlugin.js';
import { AltitudeDetectionPlugin, AltitudeDetectionShape } from '../src/r3f/AltitudeDetectionPlugin.jsx';

const dracoLoader = new DRACOLoader().setDecoderPath( 'https://www.gstatic.com/draco/v1/decoders/' );
const LAT = 35.6586 * MathUtils.DEG2RAD;
const LON = 139.7454 * MathUtils.DEG2RAD;
const PLANE_SIZE = 500;

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

		return new Array( 200 ).fill().map( c => {

			return [ ( Math.random() - 0.5 ) * PLANE_SIZE, 0, ( Math.random() - 0.5 ) * PLANE_SIZE ];

		} );

	}, [] );

	const [ height, setHeight ] = useState( 0 );
	const [ tiles, setTiles ] = useState( null );
	const [ lowPoint, setLowPoint ] = useState( null );

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

					return <Tree scale={ 5 } position={ pos } scale-y={ 5 + ( i % 10 ) * 0.5 } key={ i } />

				} )
			}

			<mesh scale={ PLANE_SIZE } rotation-x={ - Math.PI / 2 }>
				<planeGeometry />
				<meshBasicMaterial
					color={ 0 }
					polygonOffset
					polygonOffsetFactor={ - 1 }
					polygonOffsetUnits={ - 1 }
					opacity={ 0.25 }
					depthWrite={ false }
					transparent
				/>
			</mesh>

			<TilesRenderer group={ { rotation: [ - Math.PI / 2, 0, 0 ] } } ref={ setTiles }>

				{/* Sphere shows where the detected minimum point is */}
				<mesh scale={ 5 } ref={ setLowPoint }>
					<sphereGeometry />
					<meshBasicMaterial color={ 0xff0000 } />
				</mesh>

				{/* plugins */}
				<TilesPlugin plugin={ CesiumIonAuthPlugin } args={ { apiToken: import.meta.env.VITE_ION_KEY, assetId: '2275207', autoRefreshToken: true } } />
				<TilesPlugin plugin={ GLTFExtensionsPlugin } dracoLoader={ dracoLoader } />
				<TilesPlugin plugin={ ReorientationPlugin } lat={ LAT } lon={ LON } height={ height } key={ height } />
				<TilesPlugin plugin={ TileCompressionPlugin } />
				<TilesPlugin plugin={ TilesFadePlugin } />

				<TileFlatteningPlugin>
					<TileFlatteningShape relativeToEllipsoid>
						<EastNorthUpFrame lat={ LAT } lon={ LON } height={ height }>
							<mesh scale={ PLANE_SIZE }>
								<planeGeometry />
							</mesh>
						</EastNorthUpFrame>
					</TileFlatteningShape>
				</TileFlatteningPlugin>

				<AltitudeDetectionPlugin useTriangleCenters ref={ plugin => {

					// TODO: the plugin component needs to be modified to support setting of on* functions if the
					// event listener function doesn't exist and / or the field exists
					plugin.onMinAltitudeChange = ( altitude, point ) => {

						const cart = tiles.ellipsoid.getPositionToCartographic( point, {} );
						setHeight( cart.height );

						lowPoint.position.copy( point );

					};

				} }>
					<AltitudeDetectionShape relativeToEllipsoid>
						<EastNorthUpFrame lat={ LAT } lon={ LON } height={ 100 }>
							<mesh scale={ PLANE_SIZE }>
								<planeGeometry />
							</mesh>
						</EastNorthUpFrame>
					</AltitudeDetectionShape>
				</AltitudeDetectionPlugin>

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

