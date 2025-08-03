import { getBlockJson, getManifestJson, getRegistryScript } from './generator.js';
import { FogGenerator } from './fog_generator.js';
import { createDummyEntity } from './dummy_entity_generator.js';
import { FluidGeometryGenerator } from './geometry_generator.js';
import { generateBucketItemJson } from './bucket_generator.js';

document.getElementById('generateButton').addEventListener('click', async function (e) {
    e.preventDefault();
    const generateButton = document.getElementById('generateButton');
    const statusMessage = document.getElementById('statusMessage');
    const spinner = generateButton.querySelector('.spinner-border');
    const formElements = document.getElementById('fluidForm').elements;

    generateButton.disabled = true;
    spinner.classList.remove('d-none');
    for (const element of formElements) {
        element.disabled = true;
    }
    statusMessage.textContent = 'Reading user input...';

    const config = {
        name: document.getElementById('fluidName').value,
        id: document.getElementById('fluidID').value,
        fogColor: document.getElementById('fogColor').value,
        buoyancy: parseFloat(document.getElementById('buoyancy').value),
        damage: parseInt(document.getElementById('damage').value),
        lightLevel: parseInt(document.getElementById('lightLevel').value),
        tickDelay: parseInt(document.getElementById('tickDelay').value),
        effect: document.getElementById('effect').value,
        burnsEntities: document.getElementById('burnsEntities').checked,
        supportsBoats: document.getElementById('supportsBoats').checked,
    };

    // --- Input Validation and Sanitization ---
    statusMessage.textContent = 'Validating input...';
    let sanitizedId = config.id.trim().toLowerCase();
    const validIdRegex = /^[a-z0-9_]+:[a-z0-9_]+$/;

    if (!sanitizedId.includes(':')) {
        statusMessage.textContent = 'Error: Fluid ID must include a namespace (e.g., "myaddon:my_fluid").';
        generateButton.disabled = false;
        return;
    }

    if (!validIdRegex.test(sanitizedId)) {
        statusMessage.textContent = 'Error: Fluid ID contains invalid characters. Use only lowercase letters, numbers, and underscores.';
        generateButton.disabled = false;
        return;
    }
    
    // Use the sanitized ID for the rest of the generation
    config.id = sanitizedId;
    document.getElementById('fluidID').value = sanitizedId; // Update the form field to show the user the clean ID

    // --- Handle Texture File Inputs ---
    const textureFile = document.getElementById('texture').files[0];
    const flowingTextureFile = document.getElementById('flowingTexture').files[0]; // New flowing texture
    const bucketTextureFile = document.getElementById('bucketTexture').files[0];
    const packIconFile = document.getElementById('packIcon').files[0];

    try {
        const textureBuffer = await textureFile.arrayBuffer();
        const bucketTextureBuffer = await bucketTextureFile.arrayBuffer();
        
        let flowingTextureBuffer;
        if (flowingTextureFile) {
            // If user provided a flowing texture, read it.
            flowingTextureBuffer = await flowingTextureFile.arrayBuffer();
        }

        let packIconBuffer;
        if (packIconFile) {
            packIconBuffer = await packIconFile.arrayBuffer();
        } else {
            // Fetch the default icon if none is provided
            const response = await fetch('pack_icon.png');
            if (!response.ok) throw new Error('Could not load default pack icon.');
            packIconBuffer = await response.arrayBuffer();
        }

        statusMessage.textContent = 'Generating assets...';

        const zip = new JSZip();
        const safeId = config.id.replace(':', '_');
        const namespace = config.id.split(':')[0];
        const packName = `${config.name} Fluid Pack`;
        const packDesc = `A custom fluid pack for ${config.name}. Made with Bedrock Fluids API.`;

        // --- Generate Core Assets ---
        const blockJson = getBlockJson(config);
        const bucketJson = generateBucketItemJson(config);
        
        const hexColor = config.fogColor.substring(1); // Remove '#'
        const fogIdentifier = `lumstudio:${hexColor}_fog`;
        const fogJson = new FogGenerator(fogIdentifier)
            .setDistance("air", 0.0, 15.0, config.fogColor)
            .setDistance("weather", 0.0, 15.0, config.fogColor)
            .build();
        
        // --- Generate Robust Pickup Entity ---
        const pickupEntityIdentifier = "lumstudio:fluid_pickup_entity";
        const dummyFiles = createDummyEntity({ identifier: pickupEntityIdentifier });

        dummyFiles.behavior["minecraft:entity"].components["minecraft:custom_hit_test"] = {
            "hitboxes": [ { "pivot": [0, 0.5, 0], "width": 1, "height": 1 } ]
        };
        dummyFiles.behavior["minecraft:entity"].components["minecraft:type_family"] = {
             "family": ["inanimate", "fluid_pickup"] 
        };
        dummyFiles.behavior["minecraft:entity"].description.runtime_identifier = "minecraft:shulker";

        // --- Generate Fluid Geometry Dynamically ---
        const fluidGeoGenerator = new FluidGeometryGenerator();
        const fluidGeoContent = fluidGeoGenerator.generateAll().build();

        // --- Generate Manifests ---
        const rpManifest = getManifestJson(packName, packDesc, "resources");
        const bpManifest = getManifestJson(packName, packDesc, "behaviors", rpManifest.header.uuid);

        // --- Behavior Pack (BP) ---
        const bp = zip.folder('BP');
        bp.file('pack_icon.png', packIconBuffer);
        bp.file('manifest.json', JSON.stringify(bpManifest, null, 2));
        bp.folder('blocks').file(`${safeId}.json`, JSON.stringify(blockJson, null, 2));
        bp.folder('items').file(`${safeId}_bucket.json`, JSON.stringify(bucketJson, null, 2));
        bp.folder('entities').file('fluid_pickup_entity.json', JSON.stringify(dummyFiles.behavior, null, 2));
        
        // --- Scripting Engine ---
        const scriptsFolder = bp.folder('scripts');
        const scriptFiles = [
            'refactored_scripts/main.js', 'refactored_scripts/fluids.js', 'refactored_scripts/BlockUpdate.js',
            'refactored_scripts/queue.js', 'refactored_scripts/effects/index.js', 'refactored_scripts/effects/damage.js',
            'refactored_scripts/effects/burn.js', 'refactored_scripts/effects/statusEffect.js', 'refactored_scripts/effects/boat.js',
        ];
        for (const filePath of scriptFiles) {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`Failed to fetch script: ${filePath}`);
            const content = await response.text();
            const zipPath = filePath.replace('refactored_scripts/', '');
            scriptsFolder.file(zipPath, content);
        }
        scriptsFolder.file('registry.js', getRegistryScript(config));

        // --- Resource Pack (RP) ---
        const rp = zip.folder('RP');
        rp.file('pack_icon.png', packIconBuffer);
        rp.file('manifest.json', JSON.stringify(rpManifest, null, 2));
        rp.folder('fogs').file(`${hexColor}_fog.json`, JSON.stringify(fogJson, null, 2));
        
        // --- Define Texture Atlas ---
        const terrainTextureJson = {
            resource_pack_name: "vanilla",
            texture_name: "atlas.terrain",
            padding: 8,
            num_mip_levels: 4,
            texture_data: {
                [safeId]: { textures: `textures/blocks/${safeId}` }
            }
        };
        // Conditionally add the flowing texture definition
        if (flowingTextureBuffer) {
            terrainTextureJson.texture_data[`flowing_${safeId}`] = { textures: `textures/blocks/flowing_${safeId}` };
        } else {
            terrainTextureJson.texture_data[`flowing_${safeId}`] = { textures: `textures/blocks/${safeId}` };
        }

        rp.folder('textures').file('terrain_texture.json', JSON.stringify(terrainTextureJson, null, 2));

        // --- Add Other RP Files ---
        const blocksRpJson = { "format_version": "1.21.40", [config.id]: { "sound": "bucket.fill_lava" } };
        const itemTextureJson = {
            resource_pack_name: "vanilla",
            texture_name: "atlas.items",
            texture_data: { [`${safeId}_bucket`]: { textures: `textures/items/${safeId}_bucket` } }
        };
        rp.folder('entity').file('fluid_pickup_entity.json', JSON.stringify(dummyFiles.resource, null, 2));
        rp.folder('models/entity').file('dummy.json', JSON.stringify(dummyFiles.geometry, null, 2));
        rp.folder('render_controllers').file('dummy.json', JSON.stringify(dummyFiles.render_controller, null, 2));
        rp.file('blocks.json', JSON.stringify(blocksRpJson, null, 2));
        rp.folder('textures').file('item_texture.json', JSON.stringify(itemTextureJson, null, 2));
        rp.folder('models/blocks').file('fluid.geo.json', JSON.stringify(fluidGeoContent, null, 2));
        
        // --- Write Texture Files to RP ---
        rp.folder('textures/blocks').file(`${safeId}.png`, textureBuffer);
        if (flowingTextureBuffer) {
            rp.folder('textures/blocks').file(`flowing_${safeId}.png`, flowingTextureBuffer);
        }
        rp.folder('textures/items').file(`${safeId}_bucket.png`, bucketTextureBuffer);

        // --- Generate and Trigger Download ---
        statusMessage.textContent = 'Zipping files...';
        const blob = await zip.generateAsync({ type: 'blob' });
        const filename = `${config.name.replace(/\s/g, '_')}_Addon.mcaddon`;
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = URL.createObjectURL(blob);
a.download = filename;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(a.href);
        document.body.removeChild(a);

        statusMessage.textContent = 'Generation complete! Check your downloads.';
    } catch (error) {
        console.error('Error:', error);
        statusMessage.textContent = `Error: ${error.message}`;
    } finally {
        generateButton.disabled = false;
        spinner.classList.add('d-none');
        for (const element of formElements) {
            element.disabled = false;
        }
    }
});
