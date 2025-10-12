import * as THREE from 'three';
import { makeArmDownQuaternion } from './utils.js';

/**
 * Creates a walk animation.
 * @param {THREE.Skeleton} skeleton - The skeleton to animate.
 * @param {THREE.Vector3} hipPos - The initial local position of the hip bone.
 * @param {Map<string, THREE.Vector3>} markerPositions - A map of bone names to their local positions.
 * @returns {THREE.AnimationClip|null}
 */
export function createWalkAnimation(skeleton, hipPos, markerPositions) {
    const hips = skeleton.getBoneByName('hips');
    const spine = skeleton.getBoneByName('spine');
    const shoulderL = skeleton.getBoneByName('left_shoulder');
    const shoulderR = skeleton.getBoneByName('right_shoulder');
    const elbowL = skeleton.getBoneByName('left_elbow');
    const elbowR = skeleton.getBoneByName('right_elbow');
    const kneeL = skeleton.getBoneByName('left_knee');
    const kneeR = skeleton.getBoneByName('right_knee');
    const hipL = skeleton.getBoneByName('left_hip');
    const hipR = skeleton.getBoneByName('right_hip');

    if (!hips || !spine || !shoulderL || !shoulderR || !elbowL || !elbowR || !kneeL || !kneeR || !hipL || !hipR) return null;

    const walkTimes = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const walkTracks = [];
    const interpolation = THREE.InterpolateSmooth;

    // Hip position - forward/backward and side-to-side motion
    const initialHipPos = hipPos.clone();
    const stepLength = 0.02; // Smaller forward motion per step
    const hipSway = 0.015; // Side-to-side sway
    const hipVertical = 0.008; // Up/down bob

    walkTracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, walkTimes, [
        initialHipPos.x - hipSway, initialHipPos.y, initialHipPos.z,
        initialHipPos.x, initialHipPos.y + hipVertical, initialHipPos.z + stepLength * 0.25,
        initialHipPos.x + hipSway, initialHipPos.y, initialHipPos.z + stepLength * 0.5,
        initialHipPos.x, initialHipPos.y + hipVertical, initialHipPos.z + stepLength * 0.75,
        initialHipPos.x - hipSway, initialHipPos.y, initialHipPos.z + stepLength,
        initialHipPos.x, initialHipPos.y + hipVertical, initialHipPos.z + stepLength * 1.25,
        initialHipPos.x + hipSway, initialHipPos.y, initialHipPos.z + stepLength * 1.5,
        initialHipPos.x, initialHipPos.y + hipVertical, initialHipPos.z + stepLength * 1.75,
        initialHipPos.x - hipSway, initialHipPos.y, initialHipPos.z + stepLength * 2,
    ], interpolation));

    // Hip rotation - slight rotation with steps
    const hipRotAngle = Math.PI / 36; // Reduced rotation ~5 degrees
    walkTracks.push(new THREE.QuaternionKeyframeTrack(`${hips.name}.quaternion`, walkTimes, [
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -hipRotAngle, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, hipRotAngle, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -hipRotAngle, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, hipRotAngle, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -hipRotAngle, 0)).toArray(),
    ], interpolation));

    // Left hip joint - creates the stepping motion by rotating the entire leg forward/backward
    const legStepAngle = Math.PI / 12; // 15 degrees forward/backward step
    walkTracks.push(new THREE.QuaternionKeyframeTrack(`${hipL.name}.quaternion`, walkTimes, [
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, legStepAngle)).toArray(),   // Left leg forward
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),              // Neutral
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -legStepAngle)).toArray(),  // Left leg back
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),              // Neutral
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, legStepAngle)).toArray(),   // Left leg forward
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),              // Neutral
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -legStepAngle)).toArray(),  // Left leg back
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),              // Neutral
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, legStepAngle)).toArray(),   // Left leg forward
    ], interpolation));

    // Right hip joint - opposite phase to left hip
    walkTracks.push(new THREE.QuaternionKeyframeTrack(`${hipR.name}.quaternion`, walkTimes, [
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -legStepAngle)).toArray(),  // Right leg back (opposite)
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),              // Neutral
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, legStepAngle)).toArray(),   // Right leg forward
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),              // Neutral
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -legStepAngle)).toArray(),  // Right leg back
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),              // Neutral
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, legStepAngle)).toArray(),   // Right leg forward
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),              // Neutral
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -legStepAngle)).toArray(),  // Right leg back
    ], interpolation));

    // Left knee - bends when leg is lifting (when leg is moving forward)
    const kneeBendAngle = Math.PI / 6; // 30 degrees - more bend when lifting
    walkTracks.push(new THREE.QuaternionKeyframeTrack(`${kneeL.name}.quaternion`, walkTimes, [
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle, 0, 0)).toArray(),     // Max bend (leg forward/lifting)
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle * 0.5, 0, 0)).toArray(), // Straightening
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),                // Straight (leg back/planted)
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle * 0.5, 0, 0)).toArray(), // Starting to bend
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle, 0, 0)).toArray(),     // Max bend (leg forward/lifting)
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle * 0.5, 0, 0)).toArray(), // Straightening
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),                // Straight (leg back/planted)
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle * 0.5, 0, 0)).toArray(), // Starting to bend
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle, 0, 0)).toArray(),     // Max bend (leg forward/lifting)
    ], interpolation));

    // Right knee - opposite phase, bends when right leg is lifting
    walkTracks.push(new THREE.QuaternionKeyframeTrack(`${kneeR.name}.quaternion`, walkTimes, [
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),                // Straight (leg back/planted) - opposite phase
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle * 0.5, 0, 0)).toArray(), // Starting to bend
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle, 0, 0)).toArray(),     // Max bend (leg forward/lifting)
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle * 0.5, 0, 0)).toArray(), // Straightening
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),                // Straight (leg back/planted)
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle * 0.5, 0, 0)).toArray(), // Starting to bend
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle, 0, 0)).toArray(),     // Max bend (leg forward/lifting)
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(kneeBendAngle * 0.5, 0, 0)).toArray(), // Straightening
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),                // Straight (leg back/planted)
    ], interpolation));

    // Arms swing forward/backward during walk (around X-axis since arms are down)
    const qDownL = makeArmDownQuaternion(markerPositions, 'left_shoulder', 'left_elbow');
    const qDownR = makeArmDownQuaternion(markerPositions, 'right_shoulder', 'right_elbow');

    const armSwingAngle = Math.PI / 15; // 12 degrees
    const qSwingL_Forward = new THREE.Quaternion().setFromEuler(new THREE.Euler(armSwingAngle, 0, 0));
    const qSwingL_Back = new THREE.Quaternion().setFromEuler(new THREE.Euler(-armSwingAngle, 0, 0));
    const qSwingR_Forward = new THREE.Quaternion().setFromEuler(new THREE.Euler(armSwingAngle, 0, 0));
    const qSwingR_Back = new THREE.Quaternion().setFromEuler(new THREE.Euler(-armSwingAngle, 0, 0));

    // Left arm swings forward when left leg is back (natural walking motion)
    walkTracks.push(new THREE.QuaternionKeyframeTrack(`${shoulderL.name}.quaternion`, walkTimes, [
        ...qSwingL_Back.clone().multiply(qDownL).toArray(),
        ...qDownL.toArray(),
        ...qSwingL_Forward.clone().multiply(qDownL).toArray(),
        ...qDownL.toArray(),
        ...qSwingL_Back.clone().multiply(qDownL).toArray(),
        ...qDownL.toArray(),
        ...qSwingL_Forward.clone().multiply(qDownL).toArray(),
        ...qDownL.toArray(),
        ...qSwingL_Back.clone().multiply(qDownL).toArray(),
    ], interpolation));

    // Right arm swings opposite to left arm
    walkTracks.push(new THREE.QuaternionKeyframeTrack(`${shoulderR.name}.quaternion`, walkTimes, [
        ...qSwingR_Forward.clone().multiply(qDownR).toArray(),
        ...qDownR.toArray(),
        ...qSwingR_Back.clone().multiply(qDownR).toArray(),
        ...qDownR.toArray(),
        ...qSwingR_Forward.clone().multiply(qDownR).toArray(),
        ...qDownR.toArray(),
        ...qSwingR_Back.clone().multiply(qDownR).toArray(),
        ...qDownR.toArray(),
        ...qSwingR_Forward.clone().multiply(qDownR).toArray(),
    ], interpolation));

    // Slight elbow bends during walk
    const elbowWalkBend = Math.PI / 20; // Small bend
    walkTracks.push(new THREE.QuaternionKeyframeTrack(`${elbowL.name}.quaternion`, walkTimes, [
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, elbowWalkBend, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, elbowWalkBend * 1.5, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, elbowWalkBend, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, elbowWalkBend * 1.5, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, elbowWalkBend, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, elbowWalkBend * 1.5, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, elbowWalkBend, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, elbowWalkBend * 1.5, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, elbowWalkBend, 0)).toArray(),
    ], interpolation));

    walkTracks.push(new THREE.QuaternionKeyframeTrack(`${elbowR.name}.quaternion`, walkTimes, [
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -elbowWalkBend, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -elbowWalkBend * 1.5, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -elbowWalkBend, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -elbowWalkBend * 1.5, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -elbowWalkBend, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -elbowWalkBend * 1.5, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -elbowWalkBend, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -elbowWalkBend * 1.5, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -elbowWalkBend, 0)).toArray(),
    ], interpolation));

    // Spine counter-rotation for balance
    const spineCounterAngle = Math.PI / 36; // Small counter-rotation
    walkTracks.push(new THREE.QuaternionKeyframeTrack(`${spine.name}.quaternion`, walkTimes, [
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, spineCounterAngle, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -spineCounterAngle, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, spineCounterAngle, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -spineCounterAngle, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)).toArray(),
        ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, spineCounterAngle, 0)).toArray(),
    ], interpolation));

    const walkClip = new THREE.AnimationClip('walk', -1, walkTracks);
    return walkClip;
}