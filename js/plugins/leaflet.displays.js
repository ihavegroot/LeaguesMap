import "../leaflet.js";
import "./leaflet.objects.js";

export default void function (factory) {
    var L;
    if (typeof define === "function" && define.amd) {
        define(["leaflet"], factory)
    } else if (typeof module !== "undefined") {
        L = require("leaflet");
        module.exports = factory(L)
    } else {
        if (typeof window.L === "undefined") {
            throw new Error("Leaflet must be loaded first")
        }
        factory(window.L)
    }
}
(function (L) {
    L.Control.Display = L.Control.extend({
            onAdd: function (map) {
                this._map = map;
                this._container = L.DomUtil.create('div', "leaflet-control-layers leaflet-control-display");

                this.collapsed = this.createIcon(this.options.icon);
                L.DomEvent.on(this.collapsed, {
                    click: this.expand,

                }, this);
                this._container.appendChild(this.collapsed);
                this._container.title = this.options.title;
                L.DomEvent.disableClickPropagation(this._container);

                let closeIcon = L.DomUtil.create('a', "leaflet-control-display-icon-close");
                L.DomEvent.on(closeIcon, {
                    click: this.collapse,

                }, this);
                L.DomEvent.disableClickPropagation(closeIcon);

                let expandedContent = this.createInterface();
                let expandedContentContainer = L.DomUtil.create('div', 'leaflet-control-display-container-expanded');
                expandedContentContainer.appendChild(expandedContent)

                this.expanded = L.DomUtil.create('div', "leaflet-control-display");
                this.expanded.appendChild(closeIcon);
                this.expanded.appendChild(expandedContentContainer);

                // Auto-expand if option is set
                if (this.options.expand) {
                    this._container.innerHTML = '';
                    this._container.append(this.expanded);
                }

                return this._container;
            },

            // @method expand(): this
            // Expand the control container if collapsed.
            expand: function () {
                this._container.innerHTML = '';
                this._container.append(this.expanded);
                return this;
            },

            // @method collapse(): this
            // Collapse the control container.
            collapse: function () {
                this._container.innerHTML = '';
                this._container.append(this.collapsed);
                return this;
            },

            expanded: undefined,

            // @method createInterface
            // Reimplement .createInterface to set content for the expanded interface;
            // return a HTML Element
            createInterface: function () {
                return L.DomUtil.create('div');
            },

            collapsed: undefined,

            createIcon: function (icon) {
                let container = L.DomUtil.create('div', "leaflet-control-display-collapsed");
                let img = L.DomUtil.create('img', "leaflet-control-display-icon");
                img.src = icon;
                container.append(img);
                return container;
            },

            onRemove: function (map) {
                // Nothing to do here
            },

            setSearchParams: function (parameters) {
                let url = new URL(window.location.href);
                let params = url.searchParams;

                for (let[key, value]of Object.entries(parameters)) {
                    if (value || value === 0) {
                        params.set(key, value);
                    } else {
                        params.delete(key);
                    }
                }
                url.search = params;
                history.replaceState(0, "Location", url);
            },
        });

    L.control.display = function (options) {
        return new L.Control.Display(options);
    }

    L.Control.Display.Objects = L.Control.Display.extend({
            options: {
                expand: true,
                position: 'bottomleft',
                title: 'Display objects',
                icon: 'images/objects.png',
            },

            onAdd: function (map) {
                return L.Control.Display.prototype.onAdd.call(this, map);
            },
            createInterface: function () {
                let parsedUrl = new URL(window.location.href);
                let objectName = parsedUrl.searchParams.get('object') || '';

                let container = L.DomUtil.create('div', 'leaflet-control-display-expanded');

                let objectForm = L.DomUtil.create('div', 'leaflet-control-display-form', container);

                let nameDescription = L.DomUtil.create('label', 'leaflet-control-display-label', objectForm);
                nameDescription.innerHTML = "Object Name";
                let nameInput = L.DomUtil.create('input', 'leaflet-control-display-input', objectForm);
                nameInput.setAttribute('name', 'name');
                nameInput.setAttribute('value', objectName);
                nameInput.setAttribute('autocomplete', 'off');
                nameInput.setAttribute('placeholder', 'Search for object...');

                // Search on input change
                nameInput.addEventListener('input', (e) => {
                    let name = e.target.value.trim();
                    if (name) {
                        this.invokeObjectmap(name);
                    } else {
                        // Clear pins when search box is empty
                        if (this._objectmap) {
                            this._objectmap.remove();
                            this._objectmap = undefined;
                        }
                    }
                });

                // Set up region change listener
                if (this.options.regionControl) {
                    this.options.regionControl.onRegionChange(() => {
                        let currentName = nameInput.value.trim();
                        if (currentName) {
                            this.invokeObjectmap(currentName);
                        }
                    });
                }

                //Instantiate lookup if urlparam data is present
                if (objectName) {
                    this.invokeObjectmap(objectName);
                }

                return container;
            },

            submitData: function (formData) {
                let name = formData.get("name").trim();

                if (name) {
                    this.invokeObjectmap(name);
                }
            },

            _objectmap: undefined,

            invokeObjectmap: function (name) {
                if (this._objectmap) {
                    this._objectmap.remove();
                }

                this.setSearchParams({
                    object: name
                });

                if (name) {
                    let regions = this.options.regionControl ? this.options.regionControl.getEnabledRegions() : [];
                    this._objectmap = L.scenery({
                        name: name,
                        folder: this.options.folder,
                        regions: regions
                    }).addTo(this._map);
                }
            },

        });

    L.control.display.objects = function (options) {
        return new L.Control.Display.Objects(options);
    }

    L.Control.Display.NPCs = L.Control.Display.extend({
            options: {
                expand: true,
                position: 'bottomleft',
                title: 'Display NPCs',
                icon: 'images/npcs.png',
            },
            onAdd: function (map) {
                return L.Control.Display.prototype.onAdd.call(this, map);
            },

            createInterface: function () {
                let parsedUrl = new URL(window.location.href);
                let npcName = parsedUrl.searchParams.get('npc') || '';

                let container = L.DomUtil.create('div', 'leaflet-control-display-expanded');

                let npcForm = L.DomUtil.create('div', 'leaflet-control-display-form', container);

                let nameDescription = L.DomUtil.create('label', 'leaflet-control-display-label', npcForm);
                nameDescription.innerHTML = "NPC Name";
                let nameInput = L.DomUtil.create('input', 'leaflet-control-display-input', npcForm);
                nameInput.setAttribute('name', 'name');
                nameInput.setAttribute('value', npcName);
                nameInput.setAttribute('autocomplete', 'off');
                nameInput.setAttribute('placeholder', 'Search for NPC...');

                // Search on input change
                nameInput.addEventListener('input', (e) => {
                    let name = e.target.value.trim();
                    if (name) {
                        this.invokeNpcmap(name);
                    } else {
                        // Clear pins when search box is empty
                        if (this._npcmap) {
                            this._npcmap.remove();
                            this._npcmap = undefined;
                        }
                    }
                });

                // Set up region change listener
                if (this.options.regionControl) {
                    this.options.regionControl.onRegionChange(() => {
                        let currentName = nameInput.value.trim();
                        if (currentName) {
                            this.invokeNpcmap(currentName);
                        }
                    });
                }

                //Instantiate lookup if urlparam data is present
                if (npcName) {
                    this.invokeNpcmap(npcName);
                }

                return container;
            },

            submitData: function (formData) {
                let name = formData.get("name").trim();

                if (name) {
                    this.invokeNpcmap(name);
                }
            },

            _npcmap: undefined,

            invokeNpcmap: function (name) {
                if (this._npcmap) {
                    this._npcmap.remove();
                }

                this.setSearchParams({
                    npc: name
                });

                if (name) {
                    let regions = this.options.regionControl ? this.options.regionControl.getEnabledRegions() : [];
                    this._npcmap = L.npcs({
                        name: name,
                        folder: this.options.folder,
                        regions: regions
                    }).addTo(this._map);
                }
            },

        });

    L.control.display.npcs = function (options) {
        return new L.Control.Display.NPCs(options);
    }

    L.Control.Display.Items = L.Control.Display.extend({
            options: {
                position: 'bottomleft',
                title: 'Display objects',
                icon: 'images/items.png',
            },

            onAdd: function (map) {
                return L.Control.Display.prototype.onAdd.call(this, map);
            },
        });

    L.control.display.items = function (options) {
        return new L.Control.Display.Items(options);
    }
	

    L.Control.RegionFilter = L.Control.extend({
        options: {
            position: 'topleft',
        },

        onAdd: function (map) {
            this._map = map;
            let container = L.DomUtil.create('div', 'leaflet-control-region-filter leaflet-control');

            let regions = [
                { name: 'Asgarnia', icon: 'images/region_badges/Asgarnia_Area_Badge.png' },
                { name: 'Desert', icon: 'images/region_badges/Desert_Area_Badge.png' },
                { name: 'Fremennik', icon: 'images/region_badges/Fremennik_Area_Badge.png' },
                { name: 'Kandarin', icon: 'images/region_badges/Kandarin_Area_Badge.png' },
                { name: 'Karamja', icon: 'images/region_badges/Karamja_Area_Badge.png' },
                { name: 'Kourend', icon: 'images/region_badges/Kourend_Area_Badge.png' },
                { name: 'Misthalin', icon: 'images/region_badges/Misthalin_Area_Badge.png' },
                { name: 'Tirannwn', icon: 'images/region_badges/Tirannwn_Area_Badge.png' },
                { name: 'Varlamore', icon: 'images/region_badges/Varlamore_Area_Badge.png' },
                { name: 'Wilderness', icon: 'images/region_badges/Wilderness_Area_Badge.png' },
            ];

            // Load enabled regions from localStorage or default to all
            let savedRegions = localStorage.getItem('storeline_enabled_regions');
            if (savedRegions) {
                try {
                    this._enabledRegions = new Set(JSON.parse(savedRegions));
                } catch (e) {
                    this._enabledRegions = new Set(regions.map(region => region.name));
                }
            } else {
                this._enabledRegions = new Set(regions.map(region => region.name));
            }

            this._buttons = {};
            this._callbacks = [];

            let buttonContainer = L.DomUtil.create('div', 'leaflet-control-region-buttons', container);
            regions.forEach(region => {
                let button = L.DomUtil.create('button', 'leaflet-control-region-button', buttonContainer);
                button.setAttribute('type', 'button');
                button.setAttribute('title', region.name);
                button.setAttribute('data-region', region.name);

                // Apply saved state
                if (!this._enabledRegions.has(region.name)) {
                    button.classList.add('is-disabled');
                }

                let icon = L.DomUtil.create('img', 'leaflet-control-region-icon', button);
                icon.src = region.icon;
                icon.alt = region.name;

                this._buttons[region.name] = button;

                button.addEventListener('click', () => {
                    if (this._enabledRegions.has(region.name)) {
                        this._enabledRegions.delete(region.name);
                        button.classList.add('is-disabled');
                    } else {
                        this._enabledRegions.add(region.name);
                        button.classList.remove('is-disabled');
                    }

                    // Save to localStorage
                    localStorage.setItem('storeline_enabled_regions', JSON.stringify(Array.from(this._enabledRegions)));

                    // Notify callbacks
                    this._callbacks.forEach(callback => callback(Array.from(this._enabledRegions)));
                });
            });

            L.DomEvent.disableClickPropagation(container);
            return container;
        },

        getEnabledRegions: function () {
            return Array.from(this._enabledRegions);
        },

        onRegionChange: function (callback) {
            this._callbacks.push(callback);
        }
    });

    L.control.regionFilter = function (options) {
        return new L.Control.RegionFilter(options);
    }

    L.Control.Display.Storeline = L.Control.Display.extend({
            options: {
                expand: true,
                position: 'bottomleft',
                title: 'Display stores',
                icon: 'images/General_store_icon.png',
            },

            onAdd: function (map) {
                return L.Control.Display.prototype.onAdd.call(this, map);
            },

            createInterface: function () {
                let parsedUrl = new URL(window.location.href);
                let storeName = parsedUrl.searchParams.get('store') || '';

                let container = L.DomUtil.create('div', 'leaflet-control-display-expanded');

                // Store reference to region control
                this._regionControl = this.options.regionControl;
                this._itemListContainer = null;

                let storeForm = L.DomUtil.create('div', 'leaflet-control-display-form', container);

                let nameDescription = L.DomUtil.create('label', 'leaflet-control-display-label', storeForm);
                nameDescription.innerHTML = "Item Name";
                let nameInput = L.DomUtil.create('input', 'leaflet-control-display-input', storeForm);
                nameInput.setAttribute('name', 'name');
                nameInput.setAttribute('value', storeName);
                nameInput.setAttribute('autocomplete', 'off');
                nameInput.setAttribute('placeholder', 'Search for item...');

                // Search on input change
                nameInput.addEventListener('input', (e) => {
                    let name = e.target.value.trim();
                    if (name) {
                        this.invokeStoremap(name);
                    } else {
                        // Clear pins when search box is empty
                        if (this._storemap) {
                            this._storemap.remove();
                            this._storemap = undefined;
                        }
                        // Clear item list
                        if (this._itemListContainer) {
                            this._itemListContainer.innerHTML = '';
                        }
                    }
                });

                // Set up region change listener
                if (this._regionControl) {
                    this._regionControl.onRegionChange(() => {
                        let currentName = nameInput.value.trim();
                        if (currentName) {
                            this.invokeStoremap(currentName);
                        }
                    });
                }

                // Create item list container
                this._itemListContainer = L.DomUtil.create('div', 'leaflet-control-display-item-list', container);

                //Instantiate lookup if urlparam data is present
                if (storeName) {
                    this.invokeStoremap(storeName);
                }

                return container;
            },

            populateItemList: function (items, itemMap) {
                if (!this._itemListContainer) return;
                
                this._itemListContainer.innerHTML = '';
                
                if (items.length === 0) {
                    this._itemListContainer.innerHTML = '<div style="padding: 0.7em; text-align: center; color: #666;">No items found</div>';
                    return;
                }
                
                let listTitle = L.DomUtil.create('div', 'leaflet-control-display-item-list-title', this._itemListContainer);
                listTitle.innerHTML = `<b>Items (${items.length})</b>`;
                
                let listContent = L.DomUtil.create('div', 'leaflet-control-display-item-list-content', this._itemListContainer);
                
                items.forEach(itemName => {
                    let listItem = L.DomUtil.create('div', 'leaflet-control-display-item-list-item', listContent);
                    listItem.innerHTML = itemName;
                    listItem.setAttribute('data-item', itemName);
                    
                    listItem.addEventListener('click', () => {
                        // Remove previous selection
                        let prevSelected = listContent.querySelector('.is-selected');
                        if (prevSelected) {
                            prevSelected.classList.remove('is-selected');
                        }
                        
                        // Add selection
                        listItem.classList.add('is-selected');
                        
                        // Update storeline highlighting
                        if (this._storemap && this._storemap.setSelectedItem) {
                            this._storemap.setSelectedItem(itemName);
                        }
                        
                        // Center map on first location with this item
                        if (itemMap && itemMap.has(itemName)) {
                            let storeItems = itemMap.get(itemName);
                            if (storeItems.length > 0) {
                                let firstItem = storeItems[0];
                                if (firstItem.position) {
                                    this._map.setView([firstItem.position.y + 0.5, firstItem.position.x + 0.5], .5);
                                }
                            }
                        }
                    });
                });
            },

            submitData: function (formData) {
                let name = formData.get("name").trim();

                if (name) {
                    this.invokeStoremap(name);
                }
            },

            _storemap: undefined,

            invokeStoremap: function (name) {
                if (this._storemap) {
                    this._storemap.remove();
                }

                this.setSearchParams({
                    store: name
                });

                if (name && this._regionControl) {
                    this._storemap = L.storeline({
                        name: name,
                        folder: this.options.folder,
                        regions: this._regionControl.getEnabledRegions(),
                        onItemsLoaded: (items, itemMap) => {
                            this.populateItemList(items, itemMap);
                        }
                    }).addTo(this._map);
                }
            },
        });

    L.control.display.storeline = function (options) {
        return new L.Control.Display.Storeline(options);
    }

    // Unified Search Control combining Objects, NPCs, and Storeline
    L.Control.Display.UnifiedSearch = L.Control.Display.extend({
            options: {
                expand: true,
                position: 'bottomleft',
                title: 'Search',
                icon: 'images/objects.png',
            },

            onAdd: function (map) {
                return L.Control.Display.prototype.onAdd.call(this, map);
            },

            createInterface: function () {
                let parsedUrl = new URL(window.location.href);
                let searchTerm = parsedUrl.searchParams.get('search') || '';

                let container = L.DomUtil.create('div', 'leaflet-control-display-expanded');

                let searchForm = L.DomUtil.create('div', 'leaflet-control-display-form', container);

                // Search input
                let nameDescription = L.DomUtil.create('label', 'leaflet-control-display-label', searchForm);
                nameDescription.innerHTML = "Search";
                let nameInput = L.DomUtil.create('input', 'leaflet-control-display-input', searchForm);
                nameInput.setAttribute('name', 'search');
                nameInput.setAttribute('value', searchTerm);
                nameInput.setAttribute('autocomplete', 'off');
                nameInput.setAttribute('placeholder', 'Search for items, NPCs, or objects...');

                // Checkboxes container
                let checkboxContainer = L.DomUtil.create('div', 'leaflet-control-display-checkboxes', searchForm);
                checkboxContainer.style.cssText = 'display: flex; gap: 15px; margin-top: 10px; flex-wrap: wrap;';

                // Shops/Items checkbox
                let shopsCheckbox = this.createCheckbox('shops', 'Shops items', true);
                checkboxContainer.appendChild(shopsCheckbox.container);

                // NPCs checkbox
                let npcsCheckbox = this.createCheckbox('npcs', 'NPCs', true);
                checkboxContainer.appendChild(npcsCheckbox.container);

                // Objects checkbox
                let objectsCheckbox = this.createCheckbox('objects', 'Objects', true);
                checkboxContainer.appendChild(objectsCheckbox.container);

                // Strict filter checkbox
                let strictCheckbox = this.createCheckbox('strict', 'Strict search', false);
                checkboxContainer.appendChild(strictCheckbox.container);

                // Store references
                this._checkboxes = {
                    shops: shopsCheckbox.input,
                    npcs: npcsCheckbox.input,
                    objects: objectsCheckbox.input,
                    strict: strictCheckbox.input
                };
                this._regionControl = this.options.regionControl;
                this._itemListContainer = null;

                // Search on input change
                nameInput.addEventListener('input', (e) => {
                    let term = e.target.value.trim();
                    if (term) {
                        this.performSearch(term);
                    } else {
                        this.clearSearch();
                    }
                });

                // Search on checkbox change
                [shopsCheckbox.input, npcsCheckbox.input, objectsCheckbox.input, strictCheckbox.input].forEach(checkbox => {
                    checkbox.addEventListener('change', () => {
                        let term = nameInput.value.trim();
                        if (term) {
                            this.performSearch(term);
                        }
                    });
                });

                // Set up region change listener
                if (this._regionControl) {
                    this._regionControl.onRegionChange(() => {
                        let currentTerm = nameInput.value.trim();
                        if (currentTerm) {
                            this.performSearch(currentTerm);
                        }
                    });
                }

                // Create list containers for all three search types
                this._listContainer = L.DomUtil.create('div', 'leaflet-control-display-results', container);
                this._listContainer.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;';
                
                this._itemListContainer = L.DomUtil.create('div', 'leaflet-control-display-item-list', this._listContainer);
                this._npcListContainer = L.DomUtil.create('div', 'leaflet-control-display-item-list', this._listContainer);
                this._objectListContainer = L.DomUtil.create('div', 'leaflet-control-display-item-list', this._listContainer);
                
                // Initialize lists with placeholder content
                this.initializeEmptyList(this._itemListContainer, 'Shops/Items', true);
                this.initializeEmptyList(this._npcListContainer, 'NPCs', true);
                this.initializeEmptyList(this._objectListContainer, 'Objects', true);

                // Instantiate search if urlparam data is present
                if (searchTerm) {
                    this.performSearch(searchTerm);
                }

                return container;
            },

            createCheckbox: function (id, label, checked) {
                let container = L.DomUtil.create('div', 'leaflet-control-display-checkbox-group');
                container.style.cssText = 'display: flex; align-items: center; gap: 5px;';

                let input = L.DomUtil.create('input', '', container);
                input.setAttribute('type', 'checkbox');
                input.setAttribute('id', 'search-' + id);
                input.checked = checked;

                let labelElement = L.DomUtil.create('label', '', container);
                labelElement.setAttribute('for', 'search-' + id);
                labelElement.innerHTML = label;
                labelElement.style.cursor = 'pointer';
                labelElement.style.userSelect = 'none';

                return { container: container, input: input };
            },

            _objectmap: undefined,
            _npcmap: undefined,
            _storemap: undefined,

            performSearch: function (term) {
                let regions = this._regionControl ? this._regionControl.getEnabledRegions() : [];

                this.setSearchParams({
                    search: term
                });

                // Objects search
                if (this._checkboxes.objects.checked) {
                    if (this._objectmap) {
                        this._objectmap.remove();
                    }
                    this._objectmap = L.scenery({
                        name: term,
                        folder: this.options.folder,
                        regions: regions,
                        strict: this._checkboxes.strict.checked,
                        onObjectsLoaded: (objects, data) => {
                            this.populateObjectList(objects, data);
                        }
                    }).addTo(this._map);
                } else {
                    if (this._objectmap) {
                        this._objectmap.remove();
                        this._objectmap = undefined;
                    }
                    this.initializeEmptyList(this._objectListContainer, 'Objects', false);
                }

                // NPCs search
                if (this._checkboxes.npcs.checked) {
                    if (this._npcmap) {
                        this._npcmap.remove();
                    }
                    this._npcmap = L.npcs({
                        name: term,
                        folder: this.options.folder,
                        regions: regions,
                        strict: this._checkboxes.strict.checked,
                        onNPCsLoaded: (npcs, data) => {
                            this.populateNPCList(npcs, data);
                        }
                    }).addTo(this._map);
                } else {
                    if (this._npcmap) {
                        this._npcmap.remove();
                        this._npcmap = undefined;
                    }
                    this.initializeEmptyList(this._npcListContainer, 'NPCs', false);
                }

                // Shops search
                if (this._checkboxes.shops.checked) {
                    if (this._storemap) {
                        this._storemap.remove();
                    }
                    this._storemap = L.storeline({
                        name: term,
                        folder: this.options.folder,
                        regions: regions,
                        strict: this._checkboxes.strict.checked,
                        onItemsLoaded: (items, itemMap) => {
                            this.populateItemList(items, itemMap);
                        }
                    }).addTo(this._map);
                } else {
                    if (this._storemap) {
                        this._storemap.remove();
                        this._storemap = undefined;
                    }
                    this.initializeEmptyList(this._itemListContainer, 'Shops/Items', false);
                }
            },

            clearSearch: function () {
                if (this._objectmap) {
                    this._objectmap.remove();
                    this._objectmap = undefined;
                }
                if (this._npcmap) {
                    this._npcmap.remove();
                    this._npcmap = undefined;
                }
                if (this._storemap) {
                    this._storemap.remove();
                    this._storemap = undefined;
                }
                // Reset location indices
                this._itemLocationIndices = {};
                this._npcLocationIndices = {};
                this._objectLocationIndices = {};
                
                this.initializeEmptyList(this._itemListContainer, 'Shops/Items', true);
                this.initializeEmptyList(this._npcListContainer, 'NPCs', true);
                this.initializeEmptyList(this._objectListContainer, 'Objects', true);
            },

            initializeEmptyList: function (container, label, enabled) {
                if (!container) return;
                
                container.innerHTML = '';
                
                let listTitle = L.DomUtil.create('div', 'leaflet-control-display-item-list-title', container);
                listTitle.innerHTML = `<b>${label} (0)</b>`;
                
                let listContent = L.DomUtil.create('div', 'leaflet-control-display-item-list-content', container);
                listContent.style.cssText = 'max-height: 300px; overflow-y: auto; padding: 0.7em; text-align: center; color: #999;';
                
                if (enabled) {
                    listContent.innerHTML = 'Enter search term...';
                } else {
                    listContent.innerHTML = 'Disabled';
                }
            },

            populateItemList: function (items, itemMap) {
                if (!this._itemListContainer) return;
                
                this._itemListContainer.innerHTML = '';
                this._itemLocationIndices = {};
                
                let listTitle = L.DomUtil.create('div', 'leaflet-control-display-item-list-title', this._itemListContainer);
                listTitle.innerHTML = `<b>Shops/Items (${items.length})</b>`;
                
                let listContent = L.DomUtil.create('div', 'leaflet-control-display-item-list-content', this._itemListContainer);
                listContent.style.cssText = 'max-height: 300px; overflow-y: auto;';
                
                if (items.length === 0) {
                    listContent.style.cssText += ' padding: 0.7em; text-align: center; color: #999;';
                    listContent.innerHTML = 'No results';
                    return;
                }
                
                items.forEach(itemName => {
                    let storeLocations = itemMap.has(itemName) ? itemMap.get(itemName) : [];
                    let locationCount = storeLocations.length;
                    
                    let listItem = L.DomUtil.create('div', 'leaflet-control-display-item-list-item', listContent);
                    listItem.innerHTML = `${itemName} (${locationCount})`;
                    listItem.setAttribute('data-item', itemName);
                    
                    // Initialize location index for this item
                    this._itemLocationIndices[itemName] = 0;
                    
                    listItem.addEventListener('click', () => {
                        // Remove previous selection
                        let prevSelected = listContent.querySelector('.is-selected');
                        if (prevSelected && prevSelected !== listItem) {
                            prevSelected.classList.remove('is-selected');
                        }
                        
                        // Add selection
                        listItem.classList.add('is-selected');
                        
                        // Update storeline highlighting
                        if (this._storemap && this._storemap.setSelectedItem) {
                            this._storemap.setSelectedItem(itemName);
                        }
                        
                        // Cycle through locations
                        if (storeLocations.length > 0) {
                            let currentIndex = this._itemLocationIndices[itemName];
                            let location = storeLocations[currentIndex];
                            
                            if (location.position) {
                                this._map.setView([location.position.y + 0.5, location.position.x + 0.5], .5);
                            }
                            
                            // Increment and wrap around
                            this._itemLocationIndices[itemName] = (currentIndex + 1) % storeLocations.length;
                        }
                    });
                });
            },

            populateNPCList: function (npcs, data) {
                if (!this._npcListContainer) return;
                
                this._npcListContainer.innerHTML = '';
                this._npcLocationIndices = {};
                
                // Count total entries (not unique names)
                let totalEntries = data.length;
                
                let listTitle = L.DomUtil.create('div', 'leaflet-control-display-item-list-title', this._npcListContainer);
                listTitle.innerHTML = `<b>NPCs (${totalEntries})</b>`;
                
                let listContent = L.DomUtil.create('div', 'leaflet-control-display-item-list-content', this._npcListContainer);
                listContent.style.cssText = 'max-height: 300px; overflow-y: auto;';
                
                if (totalEntries === 0) {
                    listContent.style.cssText += ' padding: 0.7em; text-align: center; color: #999;';
                    listContent.innerHTML = 'No results';
                    return;
                }
                
                // Show each entry separately
                data.forEach((npc, index) => {
                    let coordinates = npc.coordinates || [];
                    let locationCount = coordinates.length;
                    
                    let listItem = L.DomUtil.create('div', 'leaflet-control-display-item-list-item', listContent);
                    listItem.innerHTML = `${npc.page_name} (${locationCount})`;
                    
                    // Use unique key based on index
                    let itemKey = `npc_${index}`;
                    this._npcLocationIndices[itemKey] = 0;
                    
                    listItem.addEventListener('click', () => {
                        // Remove previous selection
                        let prevSelected = listContent.querySelector('.is-selected');
                        if (prevSelected && prevSelected !== listItem) {
                            prevSelected.classList.remove('is-selected');
                        }
                        
                        // Add selection
                        listItem.classList.add('is-selected');
                        
                        // Cycle through locations
                        if (coordinates.length > 0) {
                            let currentIndex = this._npcLocationIndices[itemKey];
                            let coord = coordinates[currentIndex];
                            this._map.setView([coord[1] + 0.5, coord[0] + 0.5], .5);
                            
                            // Increment and wrap around
                            this._npcLocationIndices[itemKey] = (currentIndex + 1) % coordinates.length;
                        }
                    });
                });
            },

            populateObjectList: function (objects, data) {
                if (!this._objectListContainer) return;
                
                this._objectListContainer.innerHTML = '';
                this._objectLocationIndices = {};
                
                // Count total entries (not unique names)
                let totalEntries = data.length;
                
                let listTitle = L.DomUtil.create('div', 'leaflet-control-display-item-list-title', this._objectListContainer);
                listTitle.innerHTML = `<b>Objects (${totalEntries})</b>`;
                
                let listContent = L.DomUtil.create('div', 'leaflet-control-display-item-list-content', this._objectListContainer);
                listContent.style.cssText = 'max-height: 300px; overflow-y: auto;';
                
                if (totalEntries === 0) {
                    listContent.style.cssText += ' padding: 0.7em; text-align: center; color: #999;';
                    listContent.innerHTML = 'No results';
                    return;
                }
                
                // Show each entry separately
                data.forEach((obj, index) => {
                    let coordinates = obj.coordinates || [];
                    let locationCount = coordinates.length;
                    
                    let listItem = L.DomUtil.create('div', 'leaflet-control-display-item-list-item', listContent);
                    listItem.innerHTML = `${obj.page_name} (${locationCount})`;
                    
                    // Use unique key based on index
                    let itemKey = `obj_${index}`;
                    this._objectLocationIndices[itemKey] = 0;
                    
                    listItem.addEventListener('click', () => {
                        // Remove previous selection
                        let prevSelected = listContent.querySelector('.is-selected');
                        if (prevSelected && prevSelected !== listItem) {
                            prevSelected.classList.remove('is-selected');
                        }
                        
                        // Add selection
                        listItem.classList.add('is-selected');
                        
                        // Cycle through locations
                        if (coordinates.length > 0) {
                            let currentIndex = this._objectLocationIndices[itemKey];
                            let coord = coordinates[currentIndex];
                            this._map.setView([coord[1] + 0.5, coord[0] + 0.5], .5);
                            
                            // Increment and wrap around
                            this._objectLocationIndices[itemKey] = (currentIndex + 1) % coordinates.length;
                        }
                    });
                });
            },
        });

    L.control.display.unifiedSearch = function (options) {
        return new L.Control.Display.UnifiedSearch(options);
    }
	
	
 });
