import { Viewer } from './viewer.js';
import { rigCharacter } from './rigging.js';
import { detectPoseAndPlaceMarkers } from './pose_detection.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MARKER_DEFINITIONS } from './constants.js';
import { MarkerListManager } from './ui/marker_list.js';
import { EditorControls } from './ui/editor_controls.js';
import { PreviewControls } from './ui/preview_controls.js';

export class App {
    constructor() {
        this.editorViewer = null;
        this.previewViewer = null;
        this.currentMarkers = new Map();
        this.riggedModel = null;
        this.animations = {};

        this.initViews();
        this.initUI();
        this.initEventListeners();
    }

    initViews() {
        this.views = {
            upload: document.getElementById('upload-view'),
            editor: document.getElementById('editor-view'),
            preview: document.getElementById('preview-view'),
        };
    }

    initUI() {
        this.markerList = new MarkerListManager((markerId) => {
            this.editorViewer?.setActiveMarker(markerId);
        });
        this.markerList.setup();

        this.editorControls = new EditorControls({
            onRig: () => this.handleRigging(),
            onResetView: () => this.editorViewer?.resetControls(),
            onAutoDetect: () => this.handleAutoDetect()
        });

        this.previewControls = new PreviewControls({
            onStartOver: () => this.resetApp(),
            onExport: () => this.exportRiggedModel(),
            onSkeletonToggle: (visible) => this.previewViewer?.toggleSkeleton(visible),
            onAnimationChange: (name) => this.previewViewer?.playAnimation(name)
        });
    }

    initEventListeners() {
        document.getElementById('model-input').addEventListener('change', (e) => this.handleModelUpload(e));

        const uploadBox = document.querySelector('.upload-box');
        uploadBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        });
        uploadBox.addEventListener('dragleave', (e) => {
            e.currentTarget.style.backgroundColor = '';
        });
        uploadBox.addEventListener('drop', (e) => {
            e.preventDefault();
            e.currentTarget.style.backgroundColor = '';
            const input = document.getElementById('model-input');
            if (e.dataTransfer.files.length) {
                input.files = e.dataTransfer.files;
                input.dispatchEvent(new Event('change'))
            }
        });
    }

    async handleModelUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const objectURL = URL.createObjectURL(file);
        this.switchView('editor');

        if (!this.editorViewer) {
            const canvas = document.getElementById('viewer-canvas');
            this.editorViewer = new Viewer(canvas, MARKER_DEFINITIONS);
            this.editorViewer.onMarkerPlaced = (markerId, position) => this.onMarkerPlaced(markerId, position);
        }

        await this.editorViewer.loadModel(objectURL);
        this.editorViewer.resetControls();
    }

    async handleAutoDetect() {
        if (!this.editorViewer) return;

        this.editorControls.setButtonsEnabled(false);

        try {
            const markers = await detectPoseAndPlaceMarkers(
                this.editorViewer,
                (progress, label) => this.editorControls.showProgress(progress, label)
            );

            for (const [markerId, position] of markers.entries()) {
                this.editorViewer.placeMarker(markerId, position);
                this.onMarkerPlaced(markerId, position);
            }

            this.editorControls.showProgress(1, "Done!");
            setTimeout(() => {
                this.editorControls.hideProgress();
                this.editorControls.setButtonsEnabled(true);
            }, 500);

        } catch (error) {
            console.error('Auto-detect failed:', error);
            alert(error.message || 'Pose detection failed. Please try manual placement or adjust the model view.');
            this.editorControls.hideProgress();
            this.editorControls.setButtonsEnabled(true);
        }
    }

    onMarkerPlaced(markerId, position) {
        this.currentMarkers.set(markerId, position);
        this.markerList.markAsPlaced(markerId);
        this.editorControls.setRigButtonEnabled(this.markerList.areAllMarkersPlaced());

        const nextMarker = this.markerList.getNextUnplacedMarker(markerId);
        if (nextMarker) {
            this.markerList.setActiveMarker(nextMarker.id);
        }
    }

    async handleRigging() {
        this.editorControls.setButtonsEnabled(false);

        try {
            const model = this.editorViewer.getSceneData().model;
            const modelInverseMatrix = this.editorViewer.getModelInverseMatrix();
            const { riggedModel, animations } = await rigCharacter(
                model,
                this.currentMarkers,
                modelInverseMatrix,
                (progress, label) => this.editorControls.showProgress(progress, label)
            );

            this.riggedModel = riggedModel;
            this.animations = animations;

            this.editorControls.showProgress(1, 'Done!');

            setTimeout(() => {
                this.setupPreview();
                this.switchView('preview');
                this.previewControls.setExportEnabled(true);
            }, 500);

        } catch (error) {
            console.error('Rigging failed:', error);
            alert('Rigging failed. Check console for details.');
            this.editorControls.hideProgress();
            this.editorControls.setButtonsEnabled(true);
        }
    }

    setupPreview() {
        if (!this.previewViewer) {
            const canvas = document.getElementById('preview-viewer-canvas');
            this.previewViewer = new Viewer(canvas);
        }
        this.previewViewer.setModel(this.riggedModel, this.animations);
        this.previewViewer.resetControls();
        this.previewControls.populateAnimations(this.animations);
    }

    async exportRiggedModel() {
        if (!this.riggedModel) return;

        const exporter = new GLTFExporter();
        const options = {
            binary: true,
            animations: Object.values(this.animations)
        };

        exporter.parse(
            this.riggedModel,
            (gltf) => {
                const blob = new Blob([gltf], { type: 'model/gltf-binary' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'rigged-character.glb';
                a.click();
                URL.revokeObjectURL(url);
            },
            (error) => {
                console.error('An error happened during GLTF export:', error);
                alert('Failed to export model.');
            },
            options
        );
    }

    resetApp() {
        this.editorViewer?.dispose();
        this.editorViewer = null;
        this.previewViewer?.dispose();
        this.previewViewer = null;

        this.currentMarkers.clear();
        this.riggedModel = null;
        this.animations = {};

        document.getElementById('model-input').value = '';

        this.markerList.reset();
        this.editorControls.setRigButtonEnabled(false);
        this.editorControls.hideProgress();
        this.previewControls.setExportEnabled(false);
        this.previewControls.reset();

        this.switchView('upload');
    }

    switchView(viewName) {
        Object.values(this.views).forEach(v => v.classList.remove('active'));
        this.views[viewName].classList.add('active');

        const label = document.getElementById('active-marker-label');
        if (label) {
            label.style.display = (viewName === 'editor') ? 'block' : 'none';
        }
    }
}