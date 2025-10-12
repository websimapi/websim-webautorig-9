import * as THREE from 'three';

/**
 * Auto-detects pose from the 3D viewer and places markers automatically
 */

// MediaPipe Pose landmark indices mapping to our marker definitions
const POSE_LANDMARK_MAP = {
    'head': 0, // Nose (approximate head top)
    'neck': 0, // Will calculate between shoulders
    'left_shoulder': 11,
    'right_shoulder': 12,
    'left_elbow': 13,
    'right_elbow': 14,
    'left_wrist': 15,
    'right_wrist': 16,
    'left_hip': 23,
    'right_hip': 24,
    'left_knee': 25,
    'right_knee': 26,
    'left_ankle': 27,
    'right_ankle': 28,
    'hips': null, // Will calculate between left and right hip
    'spine': null, // Will calculate between neck and hips
    'left_clavicle': null, // Will calculate between neck and left shoulder
    'right_clavicle': null, // Will calculate between neck and right shoulder
};

let poseInstance = null;
let faceMeshInstance = null;

async function initializePose() {
    if (poseInstance) return poseInstance;

    const pose = new Pose({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    poseInstance = pose;
    return pose;
}

async function initializeFaceMesh() {
    if (faceMeshInstance) return faceMeshInstance;

    const faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMeshInstance = faceMesh;
    return faceMesh;
}

function findHeadTopFromRaycast(viewer, neckPosition) {
    const modelBounds = new THREE.Box3().setFromObject(viewer.model);
    const modelCenter = modelBounds.getCenter(new THREE.Vector3());
    const modelSize = modelBounds.getSize(new THREE.Vector3());

    // Start raycasting from above the model
    const startHeight = modelBounds.max.y + modelSize.y * 0.5;
    const rayOrigin = new THREE.Vector3();
    const rayDirection = new THREE.Vector3(0, -1, 0); // Downward

    let highestPoint = null;
    let highestY = -Infinity;

    // Grid pattern around the center-x position of the neck
    const centerX = neckPosition ? neckPosition.x : modelCenter.x;
    const centerZ = neckPosition ? neckPosition.z : modelCenter.z;
    const gridSize = 0.05; // 5cm grid spacing
    const gridRange = 3; // 3 steps in each direction

    for (let xOffset = -gridRange; xOffset <= gridRange; xOffset++) {
        for (let zOffset = -gridRange; zOffset <= gridRange; zOffset++) {
            rayOrigin.set(
                centerX + xOffset * gridSize,
                startHeight,
                centerZ + zOffset * gridSize
            );

            viewer.raycaster.set(rayOrigin, rayDirection);
            const intersects = viewer.raycaster.intersectObject(viewer.model, true);

            if (intersects.length > 0) {
                const hitPoint = intersects[0].point;
                if (hitPoint.y > highestY) {
                    highestY = hitPoint.y;
                    highestPoint = hitPoint.clone();
                }
            }
        }
    }

    return highestPoint;
}

export async function detectPoseAndPlaceMarkers(viewer, onProgress) {
    onProgress(0.1, "Capturing scene...");

    // Render the scene to get a clean snapshot
    viewer.renderer.render(viewer.scene, viewer.camera);
    const imageData = viewer.canvas.toDataURL('image/png');

    onProgress(0.25, "Initializing detection...");
    const pose = await initializePose();
    const faceMesh = await initializeFaceMesh();

    // Convert data URL to image
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageData;
    });

    onProgress(0.4, "Detecting face...");

    // Try face detection first
    let faceResults = null;
    try {
        faceResults = await new Promise((resolve) => {
            faceMesh.onResults(resolve);
            faceMesh.send({ image: img });
        });
    } catch (e) {
        console.warn("Face detection failed:", e);
    }

    onProgress(0.5, "Detecting pose...");

    // Run pose detection
    const results = await new Promise((resolve) => {
        pose.onResults(resolve);
        pose.send({ image: img });
    });

    if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
        throw new Error("No pose detected. Please ensure the character is visible in T-pose or A-pose.");
    }

    onProgress(0.7, "Mapping landmarks to 3D...");

    const landmarks = results.poseLandmarks;
    const markers = new Map();

    // Get model bounds for better depth estimation
    const modelBounds = new THREE.Box3().setFromObject(viewer.model);
    const modelCenter = modelBounds.getCenter(new THREE.Vector3());
    const modelSize = modelBounds.getSize(new THREE.Vector3());

    // Helper to convert 2D screen coords to 3D world position via raycasting
    const screenTo3D = (x, y, z, landmarkName = '') => {
        // MediaPipe gives normalized coords (0-1), convert to NDC (-1 to 1)
        const ndcX = (x * 2) - 1;
        const ndcY = -(y * 2) + 1; // Flip Y axis

        // Try direct raycast first
        viewer.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), viewer.camera);
        let intersects = viewer.raycaster.intersectObject(viewer.model, true);

        if (intersects.length > 0) {
            // Filter out intersects that are too far from model center (avoid hitting wrong parts)
            const validIntersects = intersects.filter(hit => 
                hit.point.distanceTo(modelCenter) < modelSize.length()
            );
            if (validIntersects.length > 0) {
                return validIntersects[0].point.clone();
            }
        }

        // If direct raycast fails, try with slight offsets in a grid pattern
        const offsetAmount = 0.02; // Small offset in NDC space
        const offsets = [
            [0, offsetAmount], [0, -offsetAmount],
            [offsetAmount, 0], [-offsetAmount, 0],
            [offsetAmount, offsetAmount], [-offsetAmount, -offsetAmount],
            [offsetAmount, -offsetAmount], [-offsetAmount, offsetAmount]
        ];

        for (const [ox, oy] of offsets) {
            viewer.raycaster.setFromCamera(new THREE.Vector2(ndcX + ox, ndcY + oy), viewer.camera);
            intersects = viewer.raycaster.intersectObject(viewer.model, true);
            
            if (intersects.length > 0) {
                const validIntersects = intersects.filter(hit => 
                    hit.point.distanceTo(modelCenter) < modelSize.length()
                );
                if (validIntersects.length > 0) {
                    return validIntersects[0].point.clone();
                }
            }
        }

        // Advanced fallback: use MediaPipe's z-depth with model bounds
        // z is normalized depth (0 = close, higher = far)
        const cameraToModel = modelCenter.distanceTo(viewer.camera.position);
        
        // Estimate depth based on z value and model position
        // Closer landmarks (z near 0) should be near the front of the model
        // Further landmarks should be proportionally deeper
        const zRange = modelSize.z * 0.5; // Half the model depth
        const estimatedDepth = cameraToModel - zRange + (z * zRange * 2);
        
        // Create a ray from the camera through the screen point
        const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
        vector.unproject(viewer.camera);
        const dir = vector.sub(viewer.camera.position).normalize();
        
        // Project to estimated depth
        const fallbackPoint = viewer.camera.position.clone().add(dir.multiplyScalar(estimatedDepth));
        
        // Clamp to model bounds to ensure reasonable placement
        fallbackPoint.x = THREE.MathUtils.clamp(fallbackPoint.x, modelBounds.min.x, modelBounds.max.x);
        fallbackPoint.y = THREE.MathUtils.clamp(fallbackPoint.y, modelBounds.min.y, modelBounds.max.y);
        fallbackPoint.z = THREE.MathUtils.clamp(fallbackPoint.z, modelBounds.min.z, modelBounds.max.z);
        
        return fallbackPoint;
    };

    // Direct mappings (skip head for now)
    for (const [markerId, landmarkIdx] of Object.entries(POSE_LANDMARK_MAP)) {
        if (markerId === 'head') continue; // Handle head separately
        if (landmarkIdx !== null && landmarks[landmarkIdx]) {
            const lm = landmarks[landmarkIdx];
            const pos3D = screenTo3D(lm.x, lm.y, lm.z, markerId);
            markers.set(markerId, pos3D);
        }
    }

    // Neck (midpoint between shoulders)
    if (landmarks[11] && landmarks[12]) {
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const midX = (leftShoulder.x + rightShoulder.x) / 2;
        const midY = (leftShoulder.y + rightShoulder.y) / 2;
        const midZ = (leftShoulder.z + rightShoulder.z) / 2;
        markers.set('neck', screenTo3D(midX, midY, midZ));
    }

    // Hips (midpoint between left and right hip)
    if (landmarks[23] && landmarks[24]) {
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const midX = (leftHip.x + rightHip.x) / 2;
        const midY = (leftHip.y + rightHip.y) / 2;
        const midZ = (leftHip.z + rightHip.z) / 2;
        markers.set('hips', screenTo3D(midX, midY, midZ));
    }

    // Spine (between neck and hips)
    if (markers.has('neck') && markers.has('hips')) {
        const neck = markers.get('neck');
        const hips = markers.get('hips');
        const spine = new THREE.Vector3().lerpVectors(hips, neck, 0.5);
        markers.set('spine', spine);
    }

    // Left clavicle (between neck and left shoulder)
    if (markers.has('neck') && markers.has('left_shoulder')) {
        const neck = markers.get('neck');
        const shoulder = markers.get('left_shoulder');
        const clavicle = new THREE.Vector3().lerpVectors(neck, shoulder, 0.3);
        markers.set('left_clavicle', clavicle);
    }

    // Right clavicle (between neck and right shoulder)
    if (markers.has('neck') && markers.has('right_shoulder')) {
        const neck = markers.get('neck');
        const shoulder = markers.get('right_shoulder');
        const clavicle = new THREE.Vector3().lerpVectors(neck, shoulder, 0.3);
        markers.set('right_clavicle', clavicle);
    }

    // HEAD PLACEMENT - Use face detection or raycast from top
    let headPosition = null;
    
    if (faceResults && faceResults.multiFaceLandmarks && faceResults.multiFaceLandmarks.length > 0) {
        // Face detected - use face landmarks for precise head placement
        const faceLandmarks = faceResults.multiFaceLandmarks[0];
        
        // Use the top center of the face (forehead area)
        // Landmark 10 is approximately the top of the forehead in MediaPipe FaceMesh
        const foreheadLandmark = faceLandmarks[10];
        
        if (foreheadLandmark) {
            // Offset slightly upward from forehead to get head top
            headPosition = screenTo3D(
                foreheadLandmark.x, 
                foreheadLandmark.y - 0.05, // Offset up to get top of head
                foreheadLandmark.z,
                'head'
            );
        }
    }
    
    if (!headPosition) {
        // No face found - use top-down raycast to find center-most top of head
        const neckPosition = markers.get('neck');
        headPosition = findHeadTopFromRaycast(viewer, neckPosition);
        
        if (!headPosition && landmarks[0]) {
            // Final fallback - use nose with upward offset
            const nose = landmarks[0];
            headPosition = screenTo3D(nose.x, nose.y - 0.08, nose.z, 'head');
        }
    }
    
    if (headPosition) {
        markers.set('head', headPosition);
    }

    onProgress(0.9, "Placing markers...");

    return markers;
}