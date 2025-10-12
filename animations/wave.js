import * as THREE from 'three';

/**
 * Creates a wave animation.
 * @param {THREE.Skeleton} skeleton - The skeleton to animate.
 * @returns {THREE.AnimationClip|null}
 */
export function createWaveAnimation(skeleton) {
    const shoulderR = skeleton.getBoneByName('right_shoulder');
    const elbowR = skeleton.getBoneByName('right_elbow');

    if (!shoulderR || !elbowR) return null;

    const times = [0, 0.5, 1, 1.5, 2];
    
    // Shoulder rotation (moves arm up and down from T-Pose)
    const shoulderZAngle = Math.PI / 4; // 45 degrees
    const shoulderValues = [
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, shoulderZAngle)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, shoulderZAngle)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
    ];
    const shoulderTrack = new THREE.QuaternionKeyframeTrack(`${shoulderR.name}.quaternion`, times, shoulderValues);

    // Elbow rotation (bends)
    const elbowYAngle = -Math.PI / 2; // -90 degrees
    const elbowValues = [
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, elbowYAngle, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, elbowYAngle, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
    ];
    const elbowTrack = new THREE.QuaternionKeyframeTrack(`${elbowR.name}.quaternion`, times, elbowValues);

    return new THREE.AnimationClip('wave', -1, [shoulderTrack, elbowTrack]);
}