export class EditorControls {
    constructor(handlers) {
        this.handlers = handlers;
        this.setupButtons();
    }

    setupButtons() {
        // Desktop buttons
        document.getElementById('rig-btn').addEventListener('click', this.handlers.onRig);
        document.getElementById('reset-view-btn').addEventListener('click', this.handlers.onResetView);
        document.getElementById('auto-detect-btn').addEventListener('click', this.handlers.onAutoDetect);
        
        // Mobile buttons
        document.getElementById('mobile-rig-btn').addEventListener('click', this.handlers.onRig);
        document.getElementById('mobile-reset-view-btn').addEventListener('click', this.handlers.onResetView);
        document.getElementById('mobile-auto-detect-btn').addEventListener('click', this.handlers.onAutoDetect);

        // Setup mobile action button icons
        document.getElementById('mobile-auto-detect-btn').style.backgroundImage = `url(./icon_auto_detect.png)`;
        document.getElementById('mobile-reset-view-btn').style.backgroundImage = `url(./icon_reset_view.png)`;
        document.getElementById('mobile-rig-btn').style.backgroundImage = `url(./icon_generate_rig.png)`;
    }

    setRigButtonEnabled(enabled) {
        document.getElementById('rig-btn').disabled = !enabled;
        document.getElementById('mobile-rig-btn').disabled = !enabled;
    }

    showProgress(progress, label) {
        const container = document.querySelector('.progress-container');
        const progressLabel = document.getElementById('progress-label');
        const progressBar = document.getElementById('progress-bar');
        
        container.style.display = 'block';
        progressBar.value = progress * 100;
        progressLabel.textContent = label;
    }

    hideProgress() {
        document.querySelector('.progress-container').style.display = 'none';
    }

    setButtonsEnabled(enabled) {
        document.getElementById('auto-detect-btn').disabled = !enabled;
        document.getElementById('mobile-auto-detect-btn').disabled = !enabled;
        document.getElementById('rig-btn').disabled = !enabled;
        document.getElementById('mobile-rig-btn').disabled = !enabled;
    }
}

