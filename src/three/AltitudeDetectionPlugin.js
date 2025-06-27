import { Matrix4, Sphere, Triangle, Vector3 } from 'three';

const _matrix = /* @__PURE__ */ new Matrix4();
const _raycaster = /* @__PURE__ */ new Raycaster();
const _triangle = /* @__PURE__ */ new Triangle();
const _normal = /* @__PURE__ */ new Vector3();
const _dir = /* @__PURE__ */ new Vector3();
const RAYCAST_DISTANCE = 1e5;

function calculateSphere( object, target ) {

	if ( object.isBufferGeometry ) {

		if ( object.boundingSphere === null ) {

			object.computeBoundingSphere();

		}

		return target.copy( object.boundingSphere );

	} else {

		_box.setFromObject( object );
		_box.getBoundingSphere( target );
		return target;

	}

}

export class AltitudeDetectionPlugin {

    constructor( options ) {

        const {
            onAltitudeChange = null,
        } = options;

        // make sure this runs before any flattening plugin
        this.name = 'MIN_ALTITUDE_DETECTION_PLUGIN';
        this.priority = - 1000;

        // options
        this.onAltitudeChange = onAltitudeChange;

        // local
        this.shapes = new Map();
		this.originalMeshes = new Map();
        this.tiles = null;
        this.needsUpdate = true;

    }

    // overriden
    init( tiles ) {

		this.tiles = tiles;
		this._onUpdateAfter = () => {

			if ( this.needsUpdate ) {

				this.shapes.forEach( info => {

					info.minAltitude = Infinity;
					info.maxAltitude = - Infinity;

				} );

				tiles.forEachLoadedModel( ( scene, tile ) => {

					this._checkScene( tile );

				} );

			}

		};

		tiles.addEventListener( 'update-after', this._onUpdateAfter );

    }

	processTileModel( scene, tile ) {

		this.originalMeshes.set( tile, scene.clone() );

	}

	disposeTile() {

		this.originalMeshes.delete( tile );

	}

    dispose(){

		tiles.removeEventListener( 'update-after', this._onUpdateAfter );

    }

	// private
	_checkScene( tile ) {

		const { shapes, originalMeshes, onAltitudeChange } = this;

		const scene = originalMeshes.get( tile );
		scene.updateMatrixWorld( true );
		scene.traverse( c => {

			const { geometry } = c;

			if ( ! geometry ) {

				return;

			}

			// calculate matrices
			_matrix.copy( c.matrixWorld );
			if ( scene.parent !== null ) {

				_matrix.premultiply( tiles.group.matrixWorldInverse );

			}

			_invMatrix.copy( _matrix ).invert();

			// calculate sphere for mesh
			calculateSphere( geometry, _sphere ).applyMatrix4( _matrix );

			shapes.forEach( info => {

				const {
					shape,
					direction,
					sphere,
				} = info;

				// check if the spheres overlap so there may actually be potential of geometry overlap
				_vec.subVectors( _sphere.center, sphere.center );
				_vec.addScaledVector( direction, - direction.dot( _vec ) );

				const r2 = ( _sphere.radius + sphere.radius ) ** 2;
				if ( _vec.lengthSq() > r2 ) {

					return;

				}

				// iterate over every vertex position
				const { position } = geometry.attributes;
				const { ray } = _raycaster;
				_dir.copy( direction ).transformDirection( _invMatrix ).normalize();
				ray.direction.copy( direction ).multiplyScalar( - 1 );

				let minAltitude = Infinity;
				let maxAltitude = - Infinity;
				forEachTriangleIndices( geometry, ( i0, i1, i2 ) => {

					_triangle.a.fromBufferAttribute( position, i0 );
					_triangle.b.fromBufferAttribute( position, i1 );
					_triangle.c.fromBufferAttribute( position, i2 );
					_triangle.getNormal( _normal );

					// avoid skirt triangles
					if ( Math.abs( _dir.dot( _normal ) ) < 0.1 ) {

						return;

					}

					ray.origin
						.fromBufferAttribute( position, i )
						.applyMatrix4( _matrix )
						.addScaledVector( direction, RAYCAST_DISTANCE );

					const hit = _raycaster.intersectObject( shape )[ 0 ];
					if ( hit ) {

						const altitude = hit.point.dot( ray.direction );
						minAltitude = Math.min( minAltitude, altitude );
						maxAltitude = Math.max( maxAltitude, altitude );

					}

				} );

				if ( minAltitude < info.minAltitude || maxAltitude > info.maxAltitude ) {

					info.minAltitude = Math.min( info.minAltitude );
					info.maxAltitude = Math.max( info.maxAltitude );

					if ( onAltitudeChange ) {

						onAltitudeChange( info.minAltitude, info.maxAltitude, shape );

					}

				}

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
			minAltitude: Infinity,
			maxAltitude: - Infinity,
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

function forEachTriangleIndices( geometry, callback ) {

	const { index, attributes } = geometry;
	const { position } = attributes;
	const triCount = index ? index.count / 3 : position.count / 3;
	for ( let i = 0; i < triCount; i ++ ) {

		let i0 = 3 * i + 0;
		let i1 = 3 * i + 1;
		let i2 = 3 * i + 2;
		if ( index ) {

			i0 = index.getX( i0 );
			i1 = index.getX( i1 );
			i2 = index.getX( i2 );

		}

		callback( i0, i1, i2 );

	}

}
