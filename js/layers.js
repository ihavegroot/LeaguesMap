"use strict";
import MD5 from "./MD5.js";
import "./leaflet.js";

(function (factory) {
    var L;
    if (typeof define === "function" && define.amd) {
        define(["leaflet"], factory);
    } else if (typeof module !== "undefined") {
        L = require("leaflet");
        module.exports = factory(L);
    } else {
        if (typeof window.L === "undefined") {
            throw new Error("Leaflet must be loaded first");
        }
        factory(window.L);
    }
})(function (L) {
    // see https://stackoverflow.com/a/60391674
    L.Map.include({
        _initControlPos: function () {
            var corners = (this._controlCorners = {}),
                l = "leaflet-",
                container = (this._controlContainer = L.DomUtil.create("div", l + "control-container", this._container));

            function createCorner(vSide, hSide) {
                var className = l + vSide + " " + l + hSide;

                corners[vSide + hSide] = L.DomUtil.create("div", className, container);
            }

            createCorner("top", "left");
            createCorner("top", "right");
            createCorner("bottom", "left");
            createCorner("bottom", "right");

            createCorner("top", "center");
            createCorner("middle", "center");
            createCorner("middle", "left");
            createCorner("middle", "right");
            createCorner("bottom", "center");
        },
    });

    L.GameMap = L.Map.extend({
        initialize: function (id, options) {
            // (HTMLElement or String, Object)

            let parsedUrl = new URL(window.location.href);

            options.zoom = Number(parsedUrl.searchParams.get("zoom") || parsedUrl.searchParams.get("z") || this._limitZoom(options.zoom) || 0);

            this._plane = Number(parsedUrl.searchParams.get("plane") || parsedUrl.searchParams.get("p") || this._limitPlane(options.plane) || 0);

            this._mapId = Number(parsedUrl.searchParams.get("mapId") || parsedUrl.searchParams.get("mapid") || parsedUrl.searchParams.get("m") || options.initialMapId || -1);
            this._era = parsedUrl.searchParams.get("era") || options.era || null;
            options.x = Number(parsedUrl.searchParams.get("x")) || options.x || 3232;
            options.y = Number(parsedUrl.searchParams.get("y")) || options.y || 3232;
            options.center = [options.y, options.x];

            options.crs = L.CRS.Simple;

            L.Map.prototype.initialize.call(this, id, options);

            this.on("moveend planechange mapidchange erachange", this.setSearchParams);

            if (this.options.baseMaps) {
                fetch(this.options.baseMaps)
                    .then((response) => response.json())
                    .then((data) => {
                        this._baseMaps = Array.isArray(data) ? this.castBaseMaps(data) : data;
                        this._allowedMapIds = Object.keys(this._baseMaps).map(Number);
                        let bounds = this.getMapIdBounds(this._mapId);

                        if (options.showMapBorder) {
                            this.boundsRect = L.rectangle(bounds, {
                                color: "#ffffff",
                                weight: 1,
                                fill: false,
                                smoothFactor: 1,
                            }).addTo(this);
                        }

                        let paddedBounds = bounds.pad(0.1);
                        this.setMaxBounds(paddedBounds);
                    });
            }

            if (options.messageBox) {
                this._messageContainer = L.DomUtil.create("div", "leaflet-control-message-container");
                this._controlContainer.appendChild(this._messageContainer);
            }
        },

        addMessage: function (message) {
            if (this.options.messageBox) {
                let messageBox = L.DomUtil.create("div", "leaflet-control-message-box");

                let messageContent = L.DomUtil.create("div", "leaflet-control-message-content");
                messageContent.innerHTML = message;
                messageBox.appendChild(messageContent);

                let clearButton = L.DomUtil.create("div", "leaflet-control-message-clear");
                clearButton.innerHTML = "[dismiss]";
                clearButton.onclick = () => this._messageContainer.removeChild(messageBox);
                messageBox.appendChild(clearButton);

                this._messageContainer.appendChild(messageBox);
                setTimeout(() => {
                    if (this._messageContainer.contains(messageBox)) {
                        this._messageContainer.removeChild(messageBox);
                    }
                }, 4000);
                return messageBox;
            } else {
                console.log(message);
            }
        },

        castBaseMaps: function (data) {
            let baseMaps = {};
            for (let i in data) {
                baseMaps[data[i].mapId] = data[i];
            }
            return baseMaps;
        },

        setSearchParams: function (
            e,
            parameters = {
                era: this._era,
                m: this._mapId,
                z: this._zoom,
                p: this._plane,
                x: Math.round(this.getCenter().lng),
                y: Math.round(this.getCenter().lat),
            }
        ) {
            let url = new URL(window.location.href);
            let params = url.searchParams;

            for (const param in ["mapId", "mapid", "zoom", "plane", "era"]) {
                params.delete(param);
            }

            for (let [key, value] of Object.entries(parameters)) {
                if (value !== null) {
                    params.set(key, value);
                }
            }
            url.search = params;
            history.replaceState(0, "Location", url);
            return Promise.resolve();
        },

        _limitPlane: function (plane) {
            //todo process allowedPlanes in basemap data
            var min = this.getMinPlane();
            var max = this.getMaxPlane();
            return Math.max(min, Math.min(max, plane));
        },

        _validateMapId: function (_mapId) {
            const parsedMapId = parseInt(_mapId);
            if (!this._allowedMapIds) {
                console.error("No basemaps found");
                return this._mapId;
            } else if (this._allowedMapIds.includes(parsedMapId)) {
                return parsedMapId;
            } else {
                console.warn("Not a valid mapId");
                return this._mapId;
            }
        },

        getPlane: function () {
            return this._plane;
        },

        getMapId: function () {
            return this._mapId;
        },

        getMinPlane: function () {
            return this.options.minPlane || 0;
        },

        getMaxPlane: function () {
            return this.options.maxPlane || 3;
        },

        setMaxPlane: function (newMaxPlane) {
            this.options.maxPlane = newMaxPlane;
            this.fire("maxplanechange", {
                newMaxPlane: newMaxPlane,
            });
        },

        setPlane: function (_plane) {
            let newPlane = this._limitPlane(_plane);
            let oldPlane = this._plane;
            if (oldPlane !== newPlane) {
                this.fire("preplanechange", {
                    oldPlane: oldPlane,
                    newPlane: newPlane,
                });
                this.fire("viewprereset");
                this._plane = newPlane;
                this.fire("viewreset");
                this.fire("planechange", {
                    oldPlane: oldPlane,
                    newPlane: newPlane,
                });
                return this;
            }
        },

        setMapId: function (_mapId) {
            let newMapId = this._validateMapId(_mapId);
            let oldMapId = this._mapId;
            if (oldMapId !== newMapId) {
                this.fire("premapidchange", {
                    oldMapId: oldMapId,
                    newMapId: newMapId,
                });
                this.fire("viewprereset");
                this._mapId = newMapId;

                this.fire("viewreset");
                this.fire("mapidchange", {
                    oldMapId: oldMapId,
                    newMapId: newMapId,
                });
                this.setMapIdBounds(newMapId);

                return this;
            }
        },

        updateAttribution: function (e) {
            let attr = this.attributionControl;

            if (attr) {
                if (e.oldEra.sources) {
                    for (const source of e.oldEra.sources) {
                        attr.removeAttribution(source);
                    }
                }
                if (e.newEra.source) {
                    for (const source of e.newEra.sources) {
                        attr.addAttribution(source);
                    }
                }
            }
        },

        setEra: function (newEra, oldEra) {
            if (oldEra === newEra) {
                return Promise.resolve();
            }

            this.fire("preerachange", {
                oldEra: oldEra,
                newEra: newEra,
            });
            this._era = newEra.key;

            let listeners = this._events["erachange"];
            let event = {
                oldEra: oldEra,
                newEra: newEra,
            };

            this.updateAttribution(event);

            //prevent _tileOnLoad/_tileReady re-triggering a opacity animation
            this._fadeAnimated = false;

            // We need to know when the tile is ready,
            let states = [];
            for (const listener of listeners) {
                let ready = listener.fn.call(listener.ctx || this, event);
                states.push(ready);
            }

            // Unblock after 1s
            const timeout = new Promise((resolve, reject) => {
                setTimeout(reject, 1000);
            });
            const all_ready = Promise.all(states);
            return Promise.race([timeout, all_ready]);
        },
    

        getMapIdBounds: function (mapId) {
            let [[west, south], [east, north]] = this._baseMaps[mapId].bounds;
            return L.latLngBounds([
                [south, west],
                [north, east],
            ]);
        },

        setMapIdBounds: function (newMapId) {
            let bounds = this.getMapIdBounds(newMapId);

            if (this.options.showMapBorder) {
                this.boundsRect.setBounds(bounds);
            }

            let paddedBounds = bounds.pad(0.1);
            this.setMaxBounds(paddedBounds);

            this.fitWorld(bounds);
        },
    });

L.gameMap = function (id, options) {
    return new L.GameMap(id, options);
};

L.TileLayer.Main = L.TileLayer.extend({
    initialize: function (url, options) {
        this._url = url;

        L.setOptions(this, options);
    },

    onAdd: function (map) {
        if (!this.options.errorTileUrl) {
            console.warn(`The ${this.options.source} layer did not have its errorTileUrl option set. This is needed to stop flickering.`);
        }
        this.options.resolved_error_url = new URL(this.options.errorTileUrl, document.location).href;

        map.on("erachange", (e) => {
            return this.refresh(map._era);
        });

        return L.TileLayer.prototype.onAdd.call(this, map);
    },

    getTileUrl: function (coords) {
        return L.Util.template(this._url, {
            source: this.options.source,
            mapId: this._map._mapId,
            zoom: coords.z,
            plane: this._map._plane || 0,
            x: coords.x,
            y: -(1 + coords.y),
            era: this._map._era || this._map.options.default_era,
        });
    },

    // Suppress 404 errors for loading tiles
    // These are expected as trivial tiles are not included to save on storage space
    createTile: function (coords, done) {
        let tile = L.TileLayer.prototype.createTile.call(this, coords, done);
        tile.onerror = (error) => error.preventDefault();
        return tile;
    },

    // "fix" for flickering:
    //
    // https://github.com/Leaflet/Leaflet/issues/6659
    // using impl from https://gist.github.com/barryhunter/e42f0c4756e34d5d07db4a170c7ec680
    _refreshTileUrl: function (layer, tile, url, sentinel1, sentinel2) {
        return new Promise((resolve, _reject) => {
            //use a image in background, so that only replace the actual tile, once image is loaded in cache!
            let img = new Image();

            img.onload = () => {
                L.Util.requestAnimFrame(() => {
                    if (sentinel1 === sentinel2) {
                        let el = tile.el;
                        el.onload = resolve;
                        el.onerror = resolve;

                        el.src = url;
                    } else {
                        resolve();
                        // a newer map is already loading, do nothing
                    }
                });
            };
            img.onerror = () => {
                L.Util.requestAnimFrame(() => {
                    if (sentinel1 === sentinel2 && tile.el.src !== this.options.resolved_error_url) {
                        let el = tile.el;
                        el.onload = resolve;
                        el.onerror = resolve;

                        el.src = layer.errorTileUrl;
                    } else {
                        resolve();
                        // a newer map is already loading, do nothing
                    }
                });
            };
            img.src = url;
        });
    },
    refresh: async function (sentinel) {
        let sentinel_ref = `${sentinel}`;

        let pending_states = [];

        for (let tile of Object.values(this._tiles)) {
            if (tile.current && (tile.active !== false)) {
                let newsrc = this.getTileUrl(tile.coords);
                let state = this._refreshTileUrl(this, tile, newsrc, sentinel, sentinel_ref);
                pending_states.push(state);
            }
        }

        await Promise.allSettled(pending_states);
    },
});

L.tileLayer.main = function (url, options) {
    return new L.TileLayer.Main(url, options);
};




// @factory L.DynamicIcons(options?: DynamicIcons options)
// Creates a new layer  with the supplied options.

L.DynamicIcons = L.Layer.extend({
    options: {
        updateWhenIdle: L.Browser.mobile,
        updateWhenZooming: true,
        updateInterval: 200,
        zIndex: 1,
        bounds: null,
        minZoom: undefined,
        maxZoom: undefined,

        // @option nativeZoom: Number
        // The zoom level at which one tile corresponds to one unit of granularity of the icon data
        nativeZoom: 2,

        // @option nativeZoomTileSize: Number
        // Px size of one tile at nativeZoom. Use a number if width and height are equal, or `L.point(width, height)` otherwise.
        nativeTileSize: 256,

        className: "",
        keepBuffer: 2,

        // @option filterFn: Function
        // Function applied by .filter() on icon data
        filterFn: undefined,

        // @option mapFn: Function
        // Function applied by .map() on icon data
        mapFn: undefined,

        // @option show3d: boolean
        // If true, shows a greyed marker if the marker is on a different plane
        show3d: true,
    },

    initialize: function (options) {
        L.setOptions(this, options);
    },

    onAdd: function (map) {
        // eslint-disable-line no-unused-vars
        if (this.options.dataPath) {
            fetch(this.options.dataPath)
                .then((response) => response.json())
                .then((response) => {
                    if (this.options.filterFn) {
                        response = response.filter(this.options.filterFn);
                    }

                    if (this.options.mapFn) {
                        response = response.map(this.options.mapFn);
                    }

                    this._icon_data = this.parseData(response);
                    this._icons = {};
                    this._resetView();
                    this._update();
                })
                .catch(console.error);
        } else {
            throw new Error("No dataPath specified");
        }
    },

    parseData: function (data) {
        data.forEach(
            (item) =>
            (item.key = this._tileCoordsToKey({
                plane: item.p ?? item.plane,
                x: item.x >> 6,
                y: -(item.y >> 6),
            }))
        );

        let icon_data = {};
        data.forEach((item) => {
            if (!(item.key in icon_data)) {
                icon_data[item.key] = [];
            }
            icon_data[item.key].push(item);
        });

        console.info("Added", data.length, "items");
        return icon_data;
    },

    onRemove: function (map) {
        // eslint-disable-line
        this._removeAllIcons();

        this._tileZoom = undefined;
    },

    // @method setZIndex(zIndex: Number): this
    // Changes the [zIndex](#gridlayer-zindex) of the grid layer.
    setZIndex: function (zIndex) {
        return L.GridLayer.prototype.setZIndex.call(this, zIndex);
    },

    // @method isLoading: Boolean
    // Returns `true` if any tile in the grid layer has not finished loading.
    isLoading: function () {
        return this._loading;
    },

    // @method redraw: this
    // Causes the layer to clear all the tiles and request them again.
    redraw: function () {
        if (this._map) {
            this._removeAllIcons();
            this._update();
        }
        return this;
    },

    getEvents: function () {
        return L.GridLayer.prototype.getEvents.call(this);
    },

    // @section
    // @method getTileSize: Point
    // Normalizes the [tileSize option](#gridlayer-tilesize) into a point. Used by the `createTile()` method.
    getTileSize: function () {
        var s = this.options.nativeTileSize;
        return s instanceof L.Point ? s : new L.Point(s, s);
    },

    _updateZIndex: function () {
        if (this._container && this.options.zIndex !== undefined && this.options.zIndex !== null) {
            this._container.style.zIndex = this.options.zIndex;
        }
    },

    _setAutoZIndex: function (compare) {
        return L.GridLayer.prototype._setAutoZIndex.call(this, compare);
    },

    _pruneIcons: function () {
        if (!this._map) {
            return;
        }

        var key, icons;

        var zoom = this._map.getZoom();
        if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
            this._removeAllIcons();
            return;
        }

        for (key in this._icons) {
            icons = this._icons[key];
            icons.retain = icons.current;
        }

        for (key in this._icons) {
            let tile = this._icons[key];
            if (tile.current && !tile.active) {
                var coords = tile.coords;
                if (!this._retainParent(coords.x, coords.y, coords.z, coords.z - 5)) {
                    this._retainChildren(coords.x, coords.y, coords.z, coords.z + 2);
                }
            }
        }

        for (key in this._icons) {
            if (!this._icons[key].retain) {
                this._removeIcons(key);
            }
        }
    },

    _removeTilesAtZoom: function (zoom) {
        for (var key in this._icons) {
            if (this._icons[key].coords.z !== zoom) {
                continue;
            }
            this._removeIcons(key);
        }
    },

    _removeAllIcons: function () {
        for (var key in this._icons) {
            this._removeIcons(key);
        }
    },

    _invalidateAll: function () {
        this._removeAllIcons();

        this._tileZoom = undefined;
    },

    _retainParent: function (x, y, z, minZoom) {
        var x2 = Math.floor(x / 2),
            y2 = Math.floor(y / 2),
            z2 = z - 1,
            coords2 = new L.Point(+x2, +y2);
        coords2.z = +z2;

        var key = this._tileCoordsToKey(coords2),
            tile = this._icons[key];

        if (tile && tile.active) {
            tile.retain = true;
            return true;
        } else if (tile && tile.loaded) {
            tile.retain = true;
        }

        if (z2 > minZoom) {
            return this._retainParent(x2, y2, z2, minZoom);
        }

        return false;
    },

    _retainChildren: function (x, y, z, maxZoom) {
        for (var i = 2 * x; i < 2 * x + 2; i++) {
            for (var j = 2 * y; j < 2 * y + 2; j++) {
                var coords = new L.Point(i, j);
                coords.z = z + 1;

                var key = this._tileCoordsToKey(coords),
                    tile = this._icons[key];

                if (tile && tile.active) {
                    tile.retain = true;
                    continue;
                } else if (tile && tile.loaded) {
                    tile.retain = true;
                }

                if (z + 1 < maxZoom) {
                    this._retainChildren(i, j, z + 1, maxZoom);
                }
            }
        }
    },

    _resetView: function (e) {
        return L.GridLayer.prototype._resetView.call(this, e);
    },

    _animateZoom: function (e) {
        return L.GridLayer.prototype._resetView.call(this, e);
    },

    _setView: function (center, zoom, noPrune, noUpdate) {
        var tileZoom = this.options.nativeZoom;

        if ((this.options.maxZoom !== undefined && zoom > this.options.maxZoom) || (this.options.minZoom !== undefined && zoom < this.options.minZoom)) {
            tileZoom = undefined;
        }

        var tileZoomChanged = this.options.updateWhenZooming && tileZoom !== this._tileZoom;
        if (!noUpdate || tileZoomChanged) {
            this._tileZoom = tileZoom;

            if (this._abortLoading) {
                this._abortLoading();
            }

            this._resetGrid();

            if (tileZoom !== undefined) {
                this._update(center);
            }

            if (!noPrune) {
                this._pruneIcons();
            }

            this._noPrune = !!noPrune;
        }
    },
    _onMoveEnd: function () {
        return L.GridLayer.prototype._onMoveEnd.call(this);
    },

    _resetGrid: function () {
        return L.GridLayer.prototype._resetGrid.call(this);
    },

    _pxBoundsToTileRange: function (bounds) {
        var tileSize = this.getTileSize();
        return new L.Bounds(bounds.min.unscaleBy(tileSize).floor(), bounds.max.unscaleBy(tileSize).ceil());
    },

    _getTiledPixelBounds: function (center) {
        return L.GridLayer.prototype._getTiledPixelBounds.call(this, center);
    },

    // Private method to load icons in the grid's active zoom level according to map bounds
    _update: function (center) {
        var map = this._map;
        if (!map) {
            return;
        }
        var zoom = this.options.nativeZoom;

        if (center === undefined) {
            center = map.getCenter();
        }
        if (this._tileZoom === undefined) {
            return;
        } // if out of minzoom/maxzoom

        var pixelBounds = this._getTiledPixelBounds(center),
            tileRange = this._pxBoundsToTileRange(pixelBounds),
            tileCenter = tileRange.getCenter(),
            queue = [],
            margin = this.options.keepBuffer,
            noPruneRange = new L.Bounds(tileRange.getBottomLeft().subtract([margin, -margin]), tileRange.getTopRight().add([margin, -margin]));

        // Sanity check: panic if the tile range contains Infinity somewhere.
        if (!(isFinite(tileRange.min.x) && isFinite(tileRange.min.y) && isFinite(tileRange.max.x) && isFinite(tileRange.max.y))) {
            throw new Error("Attempted to load an infinite number of tiles");
        }

        for (var key in this._icons) {
            var c = this._icons[key].coords;

            if (c.z !== this._tileZoom || !noPruneRange.contains(new L.Point(c.x, c.y))) {
                this._icons[key].current = false;
                this._removeIcons(key);
            }
        }

        // _update just loads more tiles. If the tile zoom level differs too much
        // from the map's, let _setView reset levels and prune old tiles.
        if (Math.abs(zoom - this._tileZoom) > 1) {
            this._setView(center, zoom);
            return;
        }

        // create a queue of coordinates to load icons for
        for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
            for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
                var coords = new L.Point(i, j);
                coords.z = this._tileZoom;
                coords.plane = this._map.getPlane();

                if (!this._isValidTile(coords)) {
                    continue;
                }

                var tile = this._icons ? this._icons[this._tileCoordsToKey(coords)] : undefined;
                if (tile) {
                    tile.current = true;
                } else {
                    var dataKey = this._tileCoordsToKey(coords);

                    if (this._icon_data && dataKey in this._icon_data) {
                        queue.push(coords);
                    }
                }
            }
        }

        // Not really necessary for icons
        // sort tile queue to load tiles in order of their distance to center
        // queue.sort((a, b) => a.distanceTo(tileCenter) - b.distanceTo(tileCenter));

        if (queue.length !== 0) {
            // if it's the first batch of tiles to load
            if (!this._loading) {
                this._loading = true;
                // @event loading: Event
                // Fired when the grid layer starts loading tiles.
                this.fire("loading");
            }

            queue.forEach((coord) => this._addIcons(coord));
            this._loading = false;
        }
    },

    _isValidTile: function (coords) {
        return L.GridLayer.prototype._isValidTile.call(this, coords);
    },

    _keyToBounds: function (key) {
        return this._tileCoordsToBounds(this._keyToTileCoords(key));
    },

    _tileCoordsToNwSe: function (coords) {
        return L.GridLayer.prototype._tileCoordsToNwSe.call(this, coords);
    },

    // converts tile coordinates to its geographical bounds
    _tileCoordsToBounds: function (coords) {
        return L.GridLayer.prototype._tileCoordsToBounds.call(this, coords);
    },
    // converts tile coordinates to key for the tile cache
    _tileCoordsToKey: function (coords) {
        try {
            return (this.options.show3d ? 0 : coords.plane) + ":" + coords.x + ":" + coords.y;
        } catch {
            throw new Error("Error parsing " + JSON.stringify(coords));
        }
    },

    // converts tile cache key to coordinates
    _keyToTileCoords: function (key) {
        var k = key.split(":");

        return {
            plane: this.options.show3d ? 0 : +k[0],
            x: +k[1],
            y: +k[2],
        };
    },

    _removeIcons: function (key) {
        var icons = this._icons[key].icons;

        if (!icons) {
            return;
        }

        icons.forEach((item) => this._map.removeLayer(item));

        delete this._icons[key];

        // Fired when a group of icons is removed
        this.fire("iconunload", {
            coords: this._keyToTileCoords(key),
        });
    },

    _getTilePos: function (coords) {
        return L.GridLayer.prototype._getTilePos.call(this, coords);
    },

    getAverageLatLng: function (icons) {
        let latlngs = icons.map((icon) => icon.getLatLng());
        let lat = latlngs.map((latlng) => latlng.lat).reduce((a, b) => a + b, 0) / icons.length;
        let lng = latlngs.map((latlng) => latlng.lng).reduce((a, b) => a + b, 0) / icons.length;
        return new L.LatLng(lat, lng);
    },

    createIcon: function (item) {
        let icon = L.icon({
            iconUrl: "images/marker-icon.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            tooltipAnchor: [16, -28],
            shadowSize: [41, 41],
        });
        let greyscaleIcon = L.icon({
            iconUrl: "images/marker-icon-greyscale.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            tooltipAnchor: [16, -28],
            shadowSize: [41, 41],
        });

        let marker = L.marker([item.y + 0.5, item.x + 0.5], {
            icon: (item.p ?? item.plane) === this._map.getPlane() ? icon : greyscaleIcon,
        });

        this._map.on("planechange", function (e) {
            marker.setIcon((item.p ?? item.plane) === e.newPlane ? icon : greyscaleIcon);
        });

        let popUpText = Object.entries(item)
            .map((x) => x.map((i) => (typeof i !== "string" ? JSON.stringify(i) : i)).join(" = "))
            .join("<br>");
        marker.bindPopup(popUpText, {
            autoPan: false,
        });

        return marker;
    },

    createPopupBody: function (mode, map, item) {
        let wrapper = document.createElement("div");

        let nav = item.start && item.destination ? this.createNavigator(mode, map, item) : document.createElement("div");

        let info = document.createElement("div");
        info.innerHTML = Object.entries(item)
            .map((x) => x.map((i) => (typeof i !== "string" ? JSON.stringify(i) : i)).join(" = "))
            .join("<br>");

        wrapper.appendChild(nav);
        wrapper.appendChild(info);
        return wrapper;
    },

    _addIcons: function (coords) {
        //var tilePos = this._getTilePos(coords);
        var key = this._tileCoordsToKey(coords);
        var dataKey = this._tileCoordsToKey(coords);
        var data = this._icon_data[dataKey];
        var icons = [];

        data.forEach((item) => {
            var icon = this.createIcon(item);
            this._map.addLayer(icon);
            icons.push(icon);
        });
        this._icons[key] = {
            icons: icons,
            coords: coords,
            current: true,
        };
    },
})});
