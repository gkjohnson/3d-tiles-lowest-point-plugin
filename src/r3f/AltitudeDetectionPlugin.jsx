import { forwardRef, useContext, useEffect, useMemo, useState } from 'react';
import { TilesPlugin, TilesPluginContext, TilesRendererContext } from '3d-tiles-renderer/r3f';
import { AltitudeDetectionPlugin as AltitudeDetectionPluginImpl } from '../../src/three/AltitudeDetectionPlugin.js';
import { Box3, Matrix4, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';

// NOTE: The flattening shape will not automatically update when child transforms are adjusted so in order
// to force a remount of the component the use should modify a "key" property when it needs to change.

// construct a hash relative to a frame
const _matrix = /* @__PURE__ */ new Matrix4();
function objectHash( obj, matrix ) {

	let hash = '';
	obj.traverse( c => {

		if ( c.geometry ) {

			_matrix.copy( c.matrixWorld ).premultiply( matrix );
			hash += c.geometry.uuid + '_';
			c.matrixWorld.elements.forEach( v => {

				hash += Math.floor( v * 1e6 ) + ',';

			} );

		}

	} );

	return hash;

}

// Helper class for adding a flattening shape to the scene
export function AltitudeDetectionShape( props ) {

	// Get the plugins and tiles
	const plugin = useContext( TilesPluginContext );
	const tiles = useContext( TilesRendererContext );

	const {
		children,

		// if true then the child geometry is rendered
		visible = false,

		// the "direction" option for "addShape"
		direction = null,

		// if true then a projection direction is derived from the shape position
		// relative to the tile set ellipsoid if "direction" is not present
		relativeToEllipsoid = false,
	} = props;

	const [ group, setGroup ] = useState( null );
	const [ hash, setHash ] = useState( null );

	// Add the provided shape to the tile set
	useEffect( () => {

		if ( tiles === null || group === null || plugin === null ) {

			return;

		}

		// ensure world transforms are up to date
		tiles.group.updateMatrixWorld();
		group.updateMatrixWorld( true );

		const relativeGroup = group.clone()
		relativeGroup
			.matrixWorld
			.copy( group.matrixWorld )
			.premultiply( tiles.group.matrixWorldInverse )
			.decompose( relativeGroup.position, relativeGroup.quaternion, relativeGroup.scale );

		// Calculate the direction to flatten on
		const _direction = new Vector3();
		if ( direction ) {

			_direction.copy( direction );

		} else if ( relativeToEllipsoid ) {

			const box = new Box3();
			box.setFromObject( relativeGroup );
			box.getCenter( _direction );
			tiles.ellipsoid.getPositionToNormal( _direction, _direction ).multiplyScalar( - 1 );

		} else {

			_direction.set( 0, 0, 1 );

		}

		// add a shape to the plugin
		plugin.addShape( relativeGroup, _direction, threshold );

		return () => {

			plugin.deleteShape( relativeGroup );

		};

	}, [ group, tiles, plugin, direction, relativeToEllipsoid, threshold, hash ] );

	// detect if the object transform or geometry has changed
	useFrame( () => {

		if ( ! tiles || ! group ) {

			return;

		}

		// TODO: this hash change is causing things to run twice
		const newHash = objectHash( group, tiles.group.matrixWorldInverse );
		if ( hash !== newHash ) {

			setHash( newHash );

		}

	} );

	return <group ref={ setGroup } visible={ visible } raycast={ () => false }>{ children }</group>;

}

// Wrapper for TilesFlatteningPlugin
export const AltitudeDetectionPlugin = forwardRef( function AltitudeDetectionPlugin( props, ref ) {

	const { children, ...rest } = props;

	return <TilesPlugin plugin={ AltitudeDetectionPluginImpl } ref={ ref } { ...rest }>{ children }</TilesPlugin>;

} );
