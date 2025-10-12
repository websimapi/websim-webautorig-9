import * as THREE from 'three';
import { makeArmDownQuaternion } from './utils.js';

/**
 * Creates an idle animation.
 * @param {THREE.Skeleton} skeleton - The skeleton to animate.
 * @param {THREE.Vector3} hipPos - The initial local position of the hip bone.
 * @param {Map<string, THREE.Vector3>} markerPositions - A map of bone names to their local positions.
 * @returns {THREE.AnimationClip|null}
 */
export function createIdleAnimation(skeleton, hipPos, markerPositions) {
    const hips = skeleton.getBoneByName('hips');
    const spine = skeleton.getBoneByName('spine');
    const shoulderL = skeleton.getBoneByName('left_shoulder');
    const shoulderR = skeleton.getBoneByName('right_shoulder');
    const elbowL = skeleton.getBoneByName('left_elbow');
    const elbowR = skeleton.getBoneByName('right_elbow');
    const kneeL = skeleton.getBoneByName('left_knee');
    const kneeR = skeleton.getBoneByName('right_knee');

    if (!hips || !spine || !shoulderL || !shoulderR || !kneeL || !kneeR) return null;

    const idleTimes = [0, 1, 2, 3, 4];
    const interpolation = THREE.InterpolateSmooth;
    const tracks = [];

    // Compute base "arms down" orientation from T-pose using marker directions
    const qDownL = makeArmDownQuaternion(markerPositions, 'left_shoulder', 'left_elbow');
    const qDownR = makeArmDownQuaternion(markerPositions, 'right_shoulder', 'right_elbow');

    // Subtle arm sway around Z while keeping them down
    const armSwayAngle = Math.PI / 36; // ~5 degrees
    const qSwayL_Pos = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, +armSwayAngle));
    const qSwayL_Neg = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -armSwayAngle));
    const qSwayR_Pos = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, +armSwayAngle));
    const qSwayR_Neg = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -armSwayAngle));

    // Compose: sway * down to keep sway relative to the "arms-down" base orientation
    const qL0 = qDownL.clone();
    const qL1 = qSwayL_Pos.clone().multiply(qDownL);
    const qL2 = qDownL.clone();
    const qL3 = qSwayL_Neg.clone().multiply(qDownL);
    const qL4 = qDownL.clone();

    tracks.push(new THREE.QuaternionKeyframeTrack(`${shoulderL.name}.quaternion`, idleTimes, [
        ...qL0.toArray(), ...qL1.toArray(), ...qL2.toArray(), ...qL3.toArray(), ...qL4.toArray()
    ], interpolation));

    const qR0 = qDownR.clone();
    const qR1 = qSwayR_Neg.clone().multiply(qDownR);
    const qR2 = qDownR.clone();
    const qR3 = qSwayR_Pos.clone().multiply(qDownR);
    const qR4 = qDownR.clone();

    tracks.push(new THREE.QuaternionKeyframeTrack(`${shoulderR.name}.quaternion`, idleTimes, [
        ...qR0.toArray(), ...qR1.toArray(), ...qR2.toArray(), ...qR3.toArray(), ...qR4.toArray()
    ], interpolation));

    // Body sway: hips translate slightly left-right, spine counter-rotates to keep upper stable
    const swayAmount = 0.01; // meters
    const initialHipPos = hipPos.clone();
    tracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, idleTimes, [
        initialHipPos.x, initialHipPos.y, initialHipPos.z,
        initialHipPos.x + swayAmount, initialHipPos.y, initialHipPos.z,
        initialHipPos.x, initialHipPos.y, initialHipPos.z,
        initialHipPos.x - swayAmount, initialHipPos.y, initialHipPos.z,
        initialHipPos.x, initialHipPos.y, initialHipPos.z,
    ], interpolation));

    const spineSwayAngle = -swayAmount / 0.2;
    const qSpine_Base = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
    const qSpine_L = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, spineSwayAngle));
    const qSpine_R = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -spineSwayAngle));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${spine.name}.quaternion`, idleTimes, [
        ...qSpine_Base.toArray(), ...qSpine_L.toArray(), ...qSpine_Base.toArray(), ...qSpine_R.toArray(), ...qSpine_Base.toArray()
    ], interpolation));

    // Light knee bends alternating
    const kneeBendAngle = Math.PI / 30; // ~6 degrees
    const qKnee_Base = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
    const qKnee_Bent = new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle, 0, 0));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${kneeR.name}.quaternion`, idleTimes, [
        ...qKnee_Base.toArray(), ...qKnee_Bent.toArray(), ...qKnee_Base.toArray(), ...qKnee_Base.toArray(), ...qKnee_Base.toArray()
    ], interpolation));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${kneeL.name}.quaternion`, idleTimes, [
        ...qKnee_Base.toArray(), ...qKnee_Base.toArray(), ...qKnee_Base.toArray(), ...qKnee_Bent.toArray(), ...qKnee_Base.toArray()
    ], interpolation));

    // Slight elbow bend so arms look natural at sides
    if (elbowL) {
        const qElbowL_Base = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 16, 0)); // small bend
        tracks.push(new THREE.QuaternionKeyframeTrack(`${elbowL.name}.quaternion`, idleTimes, [
            ...qElbowL_Base.toArray(), ...qElbowL_Base.toArray(), ...qElbowL_Base.toArray(), ...qElbowL_Base.toArray(), ...qElbowL_Base.toArray()
        ], interpolation));
    }
    if (elbowR) {
        const qElbowR_Base = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 16, 0)); // small bend
        tracks.push(new THREE.QuaternionKeyframeTrack(`${elbowR.name}.quaternion`, idleTimes, [
            ...qElbowR_Base.toArray(), ...qElbowR_Base.toArray(), ...qElbowR_Base.toArray(), ...qElbowR_Base.toArray(), ...qElbowR_Base.toArray()
        ], interpolation));
    }

    return new THREE.AnimationClip('idle', -1, tracks);
}