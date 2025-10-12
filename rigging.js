import * as THREE from 'three';
import { createAnimations } from './animations.js';

/**
 * Simplified auto-rigging implementation.
 * Creates a skeleton from markers, computes basic skinning weights,
 * and binds it to the mesh.
 */

const BONE_HIERARCHY = {
    'hips': { children: ['spine', 'left_hip', 'right_hip'] },
    'spine': { children: ['neck'] },
    'neck': { children: ['head', 'left_clavicle', 'right_clavicle'] },
    'head': { children: [] },
    'left_clavicle': { children: ['left_shoulder'] },
    'right_clavicle': { children: ['right_shoulder'] },
    'left_shoulder': { children: ['left_elbow'] },
    'right_shoulder': { children: ['right_elbow'] },
    'left_elbow': { children: ['left_wrist'] },
    'right_elbow': { children: ['right_wrist'] },
    'left_hip': { children: ['left_knee'] },
    'right_hip': { children: ['right_knee'] },
    'left_knee': { children: ['left_ankle'] },
    'right_knee': { children: ['right_ankle'] },
    'left_wrist': { children: [] },
    'right_wrist': { children: [] },
    'left_ankle': { children: [] },
    'right_ankle': { children: [] },
};

const BONE_NAMES = Object.keys(BONE_HIERARCHY);

// Helper function to calculate the squared distance from a point to a line segment.
// It's more efficient to work with squared distances to avoid square roots.
function distanceToSegmentSq(point, segStart, segEnd) {
    const l2 = segStart.distanceToSquared(segEnd);
    if (l2 === 0) return point.distanceToSquared(segStart);
    let t = ((point.x - segStart.x) * (segEnd.x - segStart.x) + (point.y - segStart.y) * (segEnd.y - segStart.y) + (point.z - segStart.z) * (segEnd.z - segStart.z)) / l2;
    t = Math.max(0, Math.min(1, t));
    const closestPointOnSegment = segStart.clone().lerp(segEnd, t);
    return point.distanceToSquared(closestPointOnSegment);
}

export async function rigCharacter(model, markers, modelInverseMatrix, onProgress) {
    onProgress(0.1, "Creating skeleton...");
    await new Promise(res => setTimeout(res, 200));

    // 1. Create bones from markers
    const bones = [];
    const boneMap = new Map();
    const markerPositions = new Map(); // Store local positions of markers
    
    // Transform marker world positions to the model's local space.
    for (const id of BONE_NAMES) {
        const worldPos = markers.get(id);
        const localPos = worldPos.clone().applyMatrix4(modelInverseMatrix);
        markerPositions.set(id, localPos);
        
        const bone = new THREE.Bone();
        bone.name = id;
        boneMap.set(id, bone);
        bones.push(bone);
    }

    // 2. Build hierarchy and set local positions
    for (const [id, bone] of boneMap.entries()) {
        const parentId = Object.keys(BONE_HIERARCHY).find(p => BONE_HIERARCHY[p].children.includes(id));
        if (parentId) {
            const parentBone = boneMap.get(parentId);
            parentBone.add(bone);
            
            // Position is relative to parent bone
            const childLocalPos = markerPositions.get(id);
            const parentLocalPos = markerPositions.get(parentId);
            bone.position.copy(childLocalPos).sub(parentLocalPos);

        } else { // This is the root bone (hips)
            bone.position.copy(markerPositions.get(id));
        }
    }

    const skeleton = new THREE.Skeleton(bones);

    // 3. Find the mesh and prepare it for skinning
    let targetMesh;
    model.traverse(child => {
        if (child.isMesh && !targetMesh) {
            targetMesh = child;
        }
    });

    if (!targetMesh) {
        throw new Error("No mesh found in the model.");
    }
    
    // The geometry is already in the correct local space.
    // We just need to ensure the mesh doesn't have a world transform applied.
    targetMesh.position.set(0,0,0);
    targetMesh.rotation.set(0,0,0);
    targetMesh.scale.set(1,1,1);
    targetMesh.updateMatrixWorld(true);


    onProgress(0.4, "Computing skinning weights...");
    await new Promise(res => setTimeout(res, 200));

    const geometry = targetMesh.geometry;
    const position = geometry.attributes.position;
    const skinIndex = new THREE.BufferAttribute(new Uint16Array(position.count * 4), 4);
    const skinWeight = new THREE.BufferAttribute(new Float32Array(position.count * 4), 4);

    // --- New skinning weight logic ---
    // Create bone segments (start and end points) in local space for more accurate distance calculation.
    const boneSegments = [];
    const boneIndexMap = new Map(bones.map((bone, index) => [bone.name, index]));

    for (const bone of bones) {
        const startPos = markerPositions.get(bone.name);
        const childrenNames = BONE_HIERARCHY[bone.name]?.children || [];
        
        if (childrenNames.length > 0) {
            // For bones with children, create segments to each child.
            for (const childName of childrenNames) {
                const endPos = markerPositions.get(childName);
                if (endPos) {
                    boneSegments.push({
                        boneIndex: boneIndexMap.get(bone.name),
                        start: startPos,
                        end: endPos
                    });
                }
            }
        } else {
             // For leaf bones (like wrists/ankles), treat them as a point.
             // We represent this as a zero-length segment.
            boneSegments.push({
                boneIndex: boneIndexMap.get(bone.name),
                start: startPos,
                end: startPos
            });
        }
    }
    
    for (let i = 0; i < position.count; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(position, i);

        // Calculate distance from the vertex to each bone segment.
        const boneDistances = boneSegments.map(segment => ({
            index: segment.boneIndex,
            // Use squared distance for efficiency
            distanceSq: distanceToSegmentSq(vertex, segment.start, segment.end)
        }));

        // Group distances by bone index, keeping the minimum distance for bones with multiple segments (e.g., hips, neck).
        const minBoneDistances = new Map();
        for (const dist of boneDistances) {
            if (!minBoneDistances.has(dist.index) || dist.distanceSq < minBoneDistances.get(dist.index)) {
                minBoneDistances.set(dist.index, dist.distanceSq);
            }
        }

        const uniqueBoneDistances = Array.from(minBoneDistances.entries()).map(([index, distanceSq]) => ({
            index,
            distance: Math.sqrt(distanceSq) // Now take the square root
        }));

        uniqueBoneDistances.sort((a, b) => a.distance - b.distance);

        const closestBones = uniqueBoneDistances.slice(0, 4);
        let totalWeight = 0;
        
        const weights = closestBones.map(b => {
            // Using a power of 4 for faster falloff, which can help reduce unwanted influence from distant bones.
            const weight = 1.0 / (Math.pow(b.distance, 4) + 1e-8);
            totalWeight += weight;
            return { weight, index: b.index };
        });

        // Normalize weights
        const finalWeights = [];
        for(let j = 0; j < 4; j++) {
            if(weights[j]) {
                finalWeights.push({
                    index: weights[j].index,
                    weight: weights[j].weight / totalWeight
                });
            } else {
                finalWeights.push({ index: 0, weight: 0 });
            }
        }

        skinIndex.setXYZW(i, finalWeights[0].index, finalWeights[1].index, finalWeights[2].index, finalWeights[3].index);
        skinWeight.setXYZW(i, finalWeights[0].weight, finalWeights[1].weight, finalWeights[2].weight, finalWeights[3].weight);
    }
    // --- End of new skinning logic ---

    geometry.setAttribute('skinIndex', skinIndex);
    geometry.setAttribute('skinWeight', skinWeight);

    // 4. Create SkinnedMesh
    const material = targetMesh.material;
    // THREE.Material doesn't have a skinning property, so we must check for it.
    if(material && 'skinning' in material) {
        material.skinning = true;
    }

    const skinnedMesh = new THREE.SkinnedMesh(geometry, material);
    
    // Add the root bone to the skinned mesh
    skinnedMesh.add(boneMap.get('hips')); 
    skinnedMesh.bind(skeleton);
    
    // The skinned mesh is created at the origin, which matches the model's centered position.

    onProgress(0.9, "Finalizing rig...");
    await new Promise(res => setTimeout(res, 200));
    
    // Create a new model group to hold the final result
    const riggedModel = new THREE.Group();
    riggedModel.add(skinnedMesh);
    
    // Create animations
    const animations = createAnimations(skeleton, boneMap.get('hips').position, markerPositions);

    return { riggedModel: riggedModel, animations };
}