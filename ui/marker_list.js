import { MARKER_DEFINITIONS } from '../constants.js';

export class MarkerListManager {
    constructor(onMarkerSelect) {
        this.onMarkerSelect = onMarkerSelect;
        this.activeMarkerId = null;
        this.placedMarkers = new Set();
    }

    setup() {
        this.setupDesktopList();
        this.setupMobileIcons();
        this.setActiveMarker(MARKER_DEFINITIONS[0].id);
    }

    setupDesktopList() {
        const listEl = document.getElementById('marker-list');
        listEl.innerHTML = '';

        MARKER_DEFINITIONS.forEach(markerDef => {
            const li = document.createElement('li');
            li.id = `marker-item-${markerDef.id}`;
            li.dataset.markerId = markerDef.id;
            li.innerHTML = `<span class="status-indicator"></span> ${markerDef.name}`;
            li.addEventListener('click', () => this.setActiveMarker(markerDef.id));
            listEl.appendChild(li);
        });
    }

    setupMobileIcons() {
        const iconsContainer = document.getElementById('marker-icons-container');
        iconsContainer.innerHTML = '';

        MARKER_DEFINITIONS.forEach(markerDef => {
            const iconButton = document.createElement('button');
            iconButton.id = `marker-icon-${markerDef.id}`;
            iconButton.dataset.markerId = markerDef.id;
            iconButton.className = 'marker-icon';
            iconButton.title = markerDef.name;
            iconButton.style.backgroundImage = `url(./${markerDef.icon})`;
            if (markerDef.id.startsWith('right_')) {
                iconButton.classList.add('flip-h');
            }
            iconButton.innerHTML = `<span class="status-indicator"></span>`;
            iconButton.addEventListener('click', () => this.setActiveMarker(markerDef.id));
            iconsContainer.appendChild(iconButton);
        });
    }

    setActiveMarker(markerId) {
        if (this.activeMarkerId) {
            document.getElementById(`marker-item-${this.activeMarkerId}`)?.classList.remove('active');
            document.getElementById(`marker-icon-${this.activeMarkerId}`)?.classList.remove('active');
        }
        this.activeMarkerId = markerId;
        document.getElementById(`marker-item-${this.activeMarkerId}`)?.classList.add('active');
        document.getElementById(`marker-icon-${this.activeMarkerId}`)?.classList.add('active');

        const markerDef = MARKER_DEFINITIONS.find(def => def.id === markerId);
        const label = document.getElementById('active-marker-label');
        if (markerDef && label) {
            label.textContent = `Tool: ${markerDef.name}`;
            label.style.display = 'block';
        }

        this.onMarkerSelect(markerId);
    }

    markAsPlaced(markerId) {
        this.placedMarkers.add(markerId);
        document.getElementById(`marker-item-${markerId}`)?.classList.add('placed');
        document.getElementById(`marker-icon-${markerId}`)?.classList.add('placed');
    }

    getNextUnplacedMarker(currentId) {
        const currentIndex = MARKER_DEFINITIONS.findIndex(def => def.id === currentId);
        return MARKER_DEFINITIONS.slice(currentIndex + 1).find(def => !this.placedMarkers.has(def.id))
            || MARKER_DEFINITIONS.slice(0, currentIndex).find(def => !this.placedMarkers.has(def.id));
    }

    areAllMarkersPlaced() {
        return MARKER_DEFINITIONS.every(def => this.placedMarkers.has(def.id));
    }

    reset() {
        this.placedMarkers.clear();
        document.querySelectorAll('#marker-list li, .marker-icon').forEach(el => 
            el.classList.remove('placed', 'active')
        );
        this.setActiveMarker(MARKER_DEFINITIONS[0].id);
    }
}