'use strict';

import "../../js/leaflet.js";
import "../../js/layers.js";
import "../../js/plugins/leaflet.plane.js";
import "../../js/plugins/leaflet.displays.js";


void function (global) {
    let runescape_map = global.runescape_map = L.gameMap('map', {

        maxBounds: [[-1000, -1000], [12800 + 1000, 12800 + 1000]],
        maxBoundsViscosity: 0.5,

        customZoomControl: true,
        fullscreenControl: true,
        planeControl: true,
        positionControl: true,
        messageBox: true,
        rect: true,
        initialMapId: -1,
        plane: 0,
        x: 3200,
        y: 3200,
        minPlane: 0,
        maxPlane: 3,
        minZoom: -4,
        maxZoom: 8,
        doubleClickZoom: false,
        showMapBorder: true,
        enableUrlLocation: true
    });

    // Create global region filter control
    let regionControl = L.control.regionFilter({
        folder: "data_osrs"
    }).addTo(runescape_map);

    // Unified search control for Objects, NPCs, and Shops
    L.control.display.unifiedSearch({
        folder: "data_osrs",
        show3d: true,
        regionControl: regionControl
    }).addTo(runescape_map);

    L.tileLayer.main('https://raw.githubusercontent.com/mejrs/layers_osrs/refs/heads/master/mapsquares/-1/{zoom}/{plane}_{x}_{y}.png', {
        minZoom: -4,
        maxNativeZoom: 4,
        maxZoom: 8,
    }).addTo(runescape_map).bringToBack();
}
(this || window);
