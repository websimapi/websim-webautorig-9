import * as THREE from 'three';

/**
 * Utility: Compute a quaternion that rotates shoulder's current rest direction (to its elbow)
 * downwards along -Y (arms at the body's side). This adapts to any incoming T-pose orientation.
 * @param {Map<string, THREE.Vector3>} markerPositions - A map of bone names to their local positions.
 * @param {string} shoulderName - The name of the shoulder bone.
 * @param {string} elbowName - The name of the elbow bone.
 * @returns {THREE.Quaternion} - The calculated quaternion.
 */
export function makeArmDownQuaternion(markerPositions, shoulderName, elbowName) {
    const s = markerPositions.get(shoulderName);
    const e = markerPositions.get(elbowName);
    if (!s || !e) return new THREE.Quaternion(); // identity fallback

    const currentDir = e.clone().sub(s).normalize();   // Shoulder -> Elbow direction in rest pose
    const downDir = new THREE.Vector3(0, -1, 0);       // Desired arm direction
    // Rotate from currentDir to downDir
    const q = new THREE.Quaternion().setFromUnitVectors(currentDir, downDir);
    return q;
};