# 3d-tiles-lowest-point-plugin

## Running

- Create a `.env` file with `VITE_ION_KEY` variable set to the users Cesium Ion key.
- Run "npm install" in the root.
- Run "npm start" in the root.
- Visit "localhost:5173"

## API

### AltitudeDetectionPlugin

Plugin for detecting the minimum and maximum altitudes in a given range as determined by raycasting against a 3d shape.

### .constructor

```js
constructor( options : Object )
```

Available options are as follows:

```js
{
	// Callbacks that fire when the associated altitudes change. The altitude value and point are relative to the
	// origin of the TilesRenderer.group frame.
	onMinAltitudeChange = null : ( altitude: number, point: Vector3, shape: Object3D ) => void,
	onMaxAltitudeChange = null : ( altitude: number, point: Vector3, shape: Object3D ) => void,

	// Angle threshold between the altitude measurement direction and face such that a point will be rejected if
	// the angle is outside of this value.
	angleThreshold = 35 * MathUtils.DEG2RAD : number,

	// If "true" then the altitude detection will sample the triangle centers rather than the corner vertices
	useTriangleCenters = false : boolean,
}
```

### .addShape

```js
addShape( shape: Object3D, direction = null: Vector3 | null ): void
```

Adds a shape within which the altitude changes will be detected along the provided direction. The direction and transformation of the shape is expected to be in the local frame of the tile set.

### .hasShape

```js
hasShape( shape: Object3D ): void
```

Returns whether a shape is currently being detected.

### .deleteShape

```js
deleteShape( shape: Object3D ): void
```

Deletes the shape from the plugin.

### .clearShapes

```js
clearShapes(): void
```

Deletes all shapes from the plugin.

### .updateShape

```js
updateShape( shape: Object3D ): void
```

Call if the geometry or transformations of the given shape have changed to update the flattening.

### R3F AltitudeDetectionPlugin

react-three-fiber Wrapper for "AltitudeDetectionPlugin":

```jsx
{ /*
	Root component for registering the plugin to the tiles renderer
*/ }
<AltitudeDetectionPlugin>

  { /*
    Shape within which vertex altitudes are detected.
    - "relativeToEllipsoid": If "true" then the detection direction is automatically derived from the shape.
    - "visible": If "true" then the shape will be visible. Useful for debugging
  */ }
  <AltitudeDetectionShape relativeToEllipsoid>

    { /*
      Any objects, meshes, and transforms nested in the detection shapes are implicitly transformed into the
      local frame of the tiles renderer and registered with the plugin.
    */ }
    <EastNorthUpFrame lat={ latitude } lon={ longitude } height={ height }>
      <mesh scale={ 500 }>
        <planeGeometry />
      </mesh>
    </EastNorthUpFrame>

  </AltitudeDetectionShape>

</AltitudeDetectionPlugin>
```
