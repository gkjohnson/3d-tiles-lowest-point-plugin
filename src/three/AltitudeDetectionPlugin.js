import { Matrix4, Sphere, Triangle, Vector3, Raycaster, Box3, MeshBasicMaterial, DoubleSide, MathUtils } from 'three';

const _matrix = /* @__PURE__ */ new Matrix4();
const _invMatrix = /* @__PURE__ */ new Matrix4();
const _raycaster = /* @__PURE__ */ new Raycaster();
const _triangle = /* @__PURE__ */ new Triangle();
const _normal = /* @__PURE__ */ new Vector3();
const _dir = /* @__PURE__ */ new Vector3();
const _box = /* @__PURE__ */ new Box3();
const _sphere = /* @__PURE__ */ new Sphere();
const _vertex = /* @__PURE__ */ new Vector3();
const _center = /* @__PURE__ */ new Vector3();
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

// Plugin for detecting the highest and lowest altitude associated with a tile set in a region
export class AltitudeDetectionPlugin {

    constructor( options = {} ) {

        const {
            onMinAltitudeChange = null,
            onMaxAltitudeChange = null,
			angleThreshold = 35 * MathUtils.DEG2RAD,
			useTriangleCenters = false,
        } = options;

        // make sure this runs before any flattening plugin
        this.name = 'MIN_ALTITUDE_DETECTION_PLUGIN';
        this.priority = - 1000;

        // callbacks for when values change
        this.onMinAltitudeChange = onMinAltitudeChange;
        this.onMaxAltitudeChange = onMaxAltitudeChange;
		this.angleThreshold = angleThreshold;
		this.useTriangleCenters = useTriangleCenters;

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

		// save the original meshes because they can be modified by other plugins like flattening
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

		const { shapes, originalMeshes, tiles, angleThreshold, useTriangleCenters, onMinAltitudeChange, onMaxAltitudeChange } = this;

		const dotThreshold = Math.cos( angleThreshold );
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
				_vertex.subVectors( _sphere.center, sphere.center );
				_vertex.addScaledVector( direction, - direction.dot( _vertex ) );

				const r2 = ( _sphere.radius + sphere.radius ) ** 2;
				if ( _vertex.lengthSq() > r2 ) {

					return;

				}


				// iterate over every vertex position
				const { position } = geometry.attributes;
				const { ray } = _raycaster;
				_dir.copy( direction ).transformDirection( _invMatrix ).normalize().multiplyScalar( - 1 );

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
					if ( _dir.dot( _normal ) < 0.1 ) {

						return;

					}

					// check each vertex
					let verts;
					if ( useTriangleCenters ) {

						_center
							.set( 0, 0, 0 )
							.addScaledVector( _triangle.a, 1 / 3 )
							.addScaledVector( _triangle.b, 1 / 3 )
							.addScaledVector( _triangle.c, 1 / 3 );
						verts = [ _center ];

					} else {

						verts = [ _triangle.a, _triangle.b, _triangle.c ];

					}

					for ( let i = 0, l = verts.length; i < l; i ++ ) {

						// get the vertex in the world frame
						const vert = verts[ i ];
						_vertex.copy( vert ).applyMatrix4( _matrix );

						// if the altitude of this vertex is not an extremity then skip
						const altitude = - _vertex.dot( direction );
						if ( altitude > result.minAltitude && altitude < result.maxAltitude ) {

							continue;

						}

						// set the raycaster to check upwards towards the shape
						ray.origin.copy( _vertex ).addScaledVector( direction, RAYCAST_DISTANCE );
						ray.direction.copy( direction ).multiplyScalar( - 1 );

						// check if the point is in the shape
						const hit = _raycaster.intersectObject( shape )[ 0 ];
						if ( hit ) {

							// set the raycaster to check downwards towards the tile geometry to see if there is
							// any other geometry in the way of this vertex
							ray.origin.copy( _vertex ).addScaledVector( direction, - RAYCAST_DISTANCE );
							ray.direction.copy( direction );

							const hit = _raycaster.intersectObject( c )[ 0 ];
							let point, normal;
							if ( hit ) {

								point = hit.point;
								normal = hit.face.normal;

							} else {

								point = _vertex;
								normal = _normal;
								continue

							}

							if ( normal.dot( _dir ) < dotThreshold ) {

								continue;

							}

							// if we hit a surface then use that point as the point for calculating altitudes
							const altitude = - point.dot( direction );
							if ( altitude < result.minAltitude ) {

								result.minNeedsDispatch = true;
								result.minAltitude = altitude;
								result.minPoint.copy( point );

							}

							if ( altitude > result.maxAltitude ) {

								result.maxNeedsDispatch = true;
								result.maxAltitude = altitude;
								result.maxPoint.copy( point );

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

// iterate over each triangle in the model
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
