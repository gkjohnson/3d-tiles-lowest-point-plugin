import { Sphere, Vector3 } from 'three';
import { OBB } from '3d-tiles-renderer';

function calculateSphere( object, target ) {

	if ( object instanceof OBB ) {

		_obb.copy( object );

	} else {

		// clone the object so we can calculate the root bounding box
		const clone = object.clone();
		clone.position.set( 0, 0, 0 );
		clone.quaternion.identity();
		clone.scale.setScalar( 1 );

		// construct obb
		_obb.box.setFromObject( clone, true );
		_obb.box.getSize( _vec );
		_obb.transform.copy( object.matrix );

	}

	// get sphere
	_obb.box.getBoundingSphere( target ).applyMatrix4( _obb.transform );

	return target;

}

export class MinAltitudeDetectionPlugin {

    constructor( options ) {

        const {
            onDetected = null,
        } = options;

        // make sure this runs before any flattening plugin
        this.name = 'MIN_ALTITUDE_DETECTION_PLUGIN';
        this.priority = - 1000;

        // options
        this.onDetected = onDetected;

        // local
        this.shapes = new Map();
        this.tiles = null;
        this.needsUpdate = true;

    }

    // overriden
    init( tiles ) {

		this.tiles = tiles;
		this._onUpdateAfter = () => {

			if ( this.needsUpdate ) {

				this.shapes.forEach( info => {

					info.lowestAltitude = Infinity;

				} );

				tiles.forEachLoadedModel( scene => {

					this._checkScene( scene );

				} );

			}

		};

		tiles.addEventListener( 'update-after', this._onUpdateAfter );

    }

    dispose(){

		tiles.removeEventListener( 'update-after', this._onUpdateAfter );

    }

	// private
	_checkScene( scene ) {

		const { shapes } = this;
		shapes.forEach( ( {
			shape,
			direction,
			sphere,
			threshold,
		} ) => {

			// TODO: check every mesh and fire lower altitudes
			scene.traverse( c => {

			} );

		} );

	}

    // public
	hasShape( mesh ) {

		return this.shapes.has( mesh );

	}

    addShape( mesh, direction = new Vector3( 0, 0, - 1 ) ) {

		const sphere = calculateSphere( mesh, new Sphere() );
		const shape = mesh.clone();
		shape.updateMatrixWorld( true );
		shape.traverse( c => {

			if ( c.material ) {

				c.material = _doubleSidedMaterial;

			}

		} );

		this.shapes.set( mesh, {
			shape: shape,
			direction: direction.clone(),
			sphere: sphere,
			lowestAltitude: Infinity,
		} );

        this.needsUpdate = true;

    }

    updateShape( mesh ) {

        if ( ! this.hasShape( mesh ) ) {

			throw new Error( 'TileFlatteningPlugin: Shape is already used.' );

		}

		const info = this.shapes.get( mesh );
		calculateSphere( mesh, info.sphere );
		info.shape = mesh.clone();
		info.shape.updateMatrixWorld( true );
		info.shape.traverse( c => {

			if ( c.material ) {

				c.material = _doubleSidedMaterial;

			}

		} );

		this.needsUpdate = true;

    }

    deleteShape( mesh ) {

		this.needsUpdate = true;
		return this.shapes.delete( mesh );

    }

    clearShapes() {

		const { shapes } = this;
		if ( shapes.size === 0 ) {

			return;

		}

		shapes.clear();
		this.needsUpdate = true;

    }

}
