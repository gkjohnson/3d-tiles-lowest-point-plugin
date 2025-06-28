import { Matrix4, Sphere, Triangle, Vector3, Raycaster, Box3, MeshBasicMaterial, DoubleSide } from 'three';

const _matrix = /* @__PURE__ */ new Matrix4();
const _invMatrix = /* @__PURE__ */ new Matrix4();
const _raycaster = /* @__PURE__ */ new Raycaster();
const _triangle = /* @__PURE__ */ new Triangle();
const _normal = /* @__PURE__ */ new Vector3();
const _dir = /* @__PURE__ */ new Vector3();
const _box = /* @__PURE__ */ new Box3();
const _sphere = /* @__PURE__ */ new Sphere();
const _vec = /* @__PURE__ */ new Vector3();
const _doubleSidedMaterial = /* @__PURE__ */ new MeshBasicMaterial( { side: DoubleSide } );

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

    constructor( options = {} ) {

        const {
            onMinAltitudeChange = null,
            onMaxAltitudeChange = null,
        } = options;

        // make sure this runs before any flattening plugin
        this.name = 'MIN_ALTITUDE_DETECTION_PLUGIN';
        this.priority = - 1000;

        // options
        this.onMinAltitudeChange = onMinAltitudeChange;
        this.onMaxAltitudeChange = onMaxAltitudeChange;

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

					info.result.minAltitude = Infinity;
					info.result.maxAltitude = - Infinity;

				} );

				tiles.forEachLoadedModel( ( scene, tile ) => {

					this._checkScene( tile );

				} );

				this.needsUpdate = false;

			}

		};

		tiles.forEachLoadedModel( ( scene, tile ) => {

			this.originalMeshes.set( tile, scene.clone() );

		} );

		tiles.addEventListener( 'update-after', this._onUpdateAfter );

    }

	processTileModel( scene, tile ) {

		this.originalMeshes.set( tile, scene.clone() );
		this._checkScene( tile );

	}

	disposeTile( tile ) {

		this.originalMeshes.delete( tile );

	}

    dispose(){

		this.tiles.removeEventListener( 'update-after', this._onUpdateAfter );

    }

	// private
	_checkScene( tile ) {

		const { shapes, originalMeshes, tiles, onMinAltitudeChange, onMaxAltitudeChange } = this;

		const checkedVertices = new Set();
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
					result,
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
				_dir.copy( direction ).transformDirection( _invMatrix ).normalize().multiplyScalar( - 1 );
				ray.direction.copy( direction ).multiplyScalar( - 1 );

				let didMinChange = false;
				let didMaxChange = false;
				checkedVertices.clear();
				forEachTriangleIndices( geometry, ( i0, i1, i2 ) => {

					// return early if we've already checked all the vertices
					if (
						checkedVertices.has( i0 ) &&
						checkedVertices.has( i1 ) &&
						checkedVertices.has( i2 )
					) {

						return;

					}

					// get the triangle
					_triangle.a.fromBufferAttribute( position, i0 );
					_triangle.b.fromBufferAttribute( position, i1 );
					_triangle.c.fromBufferAttribute( position, i2 );
					_triangle.getNormal( _normal );

					// avoid skirt triangles by skipping any points from triangles that
					// are orthogonal to the altitude check direction
					if ( _dir.dot( _normal ) < 0.999 ) {

						return;

					}

					// check each vertex
					const indices = [ i0, i1, i2 ];
					const verts = [ _triangle.a, _triangle.b, _triangle.c ];
					for ( let i = 0; i < 3; i ++ ) {

						// skip the vertex if we've already checked it
						const index = indices[ i ];
						const vert = verts[ i ];
						if ( checkedVertices.has( index ) ) {

							continue;

						}

						checkedVertices.add( index );

						// prepare the raycast origin
						ray.origin
							.copy( vert )
							.applyMatrix4( _matrix )
							.addScaledVector( direction, RAYCAST_DISTANCE );

						// calculate the altitude
						const hit = _raycaster.intersectObject( shape )[ 0 ];
						if ( hit ) {

							hit.point.copy( vert ).applyMatrix4( _matrix );

							const altitude = hit.point.dot( ray.direction );
							if ( altitude < result.minAltitude ) {

								result.minNeedsDispatch = true;
								result.minAltitude = altitude;
								result.minPoint.copy( hit.point );

							}

							if ( altitude > result.maxAltitude ) {

								result.maxNeedsDispatch = true;
								result.maxAltitude = altitude;
								result.maxPoint.copy( hit.point );

							}

						}

					}

				} );

				if ( ! result.scheduled ) {

					result.scheduled = true;
					queueMicrotask( () => {

						// dispatch events
						if ( result.minNeedsDispatch && onMinAltitudeChange ) {

							onMinAltitudeChange( result.minAltitude, result.minPoint, shape );

						}

						if ( result.maxNeedsDispatch && onMaxAltitudeChange ) {

							onMaxAltitudeChange( result.maxAltitude, result.maxPoint, shape );

						}

						result.minNeedsDispatch = false;
						result.maxNeedsDispatch = false;
						result.scheduled = false;

					} );

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
			result: {
				minPoint: new Vector3(),
				minAltitude: Infinity,
				minNeedsDispatch: false,

				maxPoint: new Vector3(),
				maxAltitude: - Infinity,
				maxNeedsDispatch: false,

				scheduled: false,
			},
		} );

        this.needsUpdate = true;

    }

    updateShape( mesh ) {

		if ( ! this.hasShape( mesh ) ) {

			throw new Error( 'TileFlatteningPlugin: Shape is not present.' );

		}

		const { direction } = this.shapes.get( mesh );
		this.deleteShape( mesh );
		this.addShape( mesh, direction );

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
