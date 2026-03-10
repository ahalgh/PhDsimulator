/**
 * Generate detailed isometric placeholder sprites as SVG files.
 * Run with: node scripts/generate-placeholders.js
 *
 * Creates proper isometric buildings with 3D depth, varied roofs,
 * and visual upgrades per level. Much more detailed than V1.
 */

const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public', 'assets');

// ─── Isometric building generator with 3D projection ───

function isoBuilding(w, h, cfg) {
    const { base, roof, accent, level, label, shape } = cfg;
    // Building grows taller and more ornate with level
    const stories = level;
    const storyH = 10 + level * 2;
    const totalBuildH = stories * storyH;
    const footW = w * 0.55;
    const footD = footW * 0.5; // isometric depth
    const cx = w / 2;
    const groundY = h - 12;
    const wallTop = groundY - totalBuildH;

    // Isometric offsets
    const isoLeft = -footW / 2;
    const isoRight = footW / 2;
    const isoUp = -footD / 2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;

    // Shadow
    svg += `<ellipse cx="${cx}" cy="${groundY + 4}" rx="${footW * 0.6}" ry="${footD * 0.4}" fill="rgba(0,0,0,0.25)"/>`;

    // Left wall (darker)
    const lx1 = cx + isoLeft, ly1 = groundY;
    const lx2 = cx, ly2 = groundY + isoUp;
    const lx3 = cx, ly3 = wallTop + isoUp;
    const lx4 = cx + isoLeft, ly4 = wallTop;
    svg += `<polygon points="${lx1},${ly1} ${lx2},${ly2} ${lx3},${ly3} ${lx4},${ly4}" fill="${darken(base, 0.7)}"/>`;

    // Right wall (base color)
    const rx1 = cx, ry1 = groundY + isoUp;
    const rx2 = cx + isoRight, ry2 = groundY;
    const rx3 = cx + isoRight, ry3 = wallTop;
    const rx4 = cx, ry4 = wallTop + isoUp;
    svg += `<polygon points="${rx1},${ry1} ${rx2},${ry2} ${rx3},${ry3} ${rx4},${ry4}" fill="${base}"/>`;

    // Floor lines for stories
    for (let s = 1; s < stories; s++) {
        const sy = groundY - s * storyH;
        svg += `<line x1="${cx + isoLeft}" y1="${sy}" x2="${cx}" y2="${sy + isoUp}" stroke="rgba(0,0,0,0.15)" stroke-width="0.5"/>`;
        svg += `<line x1="${cx}" y1="${sy + isoUp}" x2="${cx + isoRight}" y2="${sy}" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>`;
    }

    // Windows on left wall
    for (let s = 0; s < Math.min(stories, 4); s++) {
        const wy = groundY - s * storyH - storyH * 0.5;
        for (let wi = 0; wi < Math.min(level, 2); wi++) {
            const wx = cx + isoLeft + 6 + wi * 10;
            svg += `<rect x="${wx}" y="${wy}" width="5" height="5" fill="${accent}" opacity="0.9" rx="0.5"/>`;
            svg += `<rect x="${wx + 1}" y="${wy + 1}" width="3" height="3" fill="rgba(255,255,200,0.5)" rx="0.3"/>`;
        }
    }

    // Windows on right wall
    for (let s = 0; s < Math.min(stories, 4); s++) {
        const wy = groundY - s * storyH - storyH * 0.5;
        for (let wi = 0; wi < Math.min(level, 2); wi++) {
            const wx = cx + 4 + wi * 10;
            svg += `<rect x="${wx}" y="${wy}" width="5" height="5" fill="${accent}" opacity="0.7" rx="0.5"/>`;
            svg += `<rect x="${wx + 1}" y="${wy + 1}" width="3" height="3" fill="rgba(255,255,200,0.4)" rx="0.3"/>`;
        }
    }

    // Roof
    if (shape === 'pointed') {
        // Pointed roof (tower, castle)
        const peakY = wallTop - 14 - level * 3;
        svg += `<polygon points="${cx + isoLeft - 2},${wallTop} ${cx},${wallTop + isoUp - 2} ${cx},${peakY}" fill="${darken(roof, 0.8)}"/>`;
        svg += `<polygon points="${cx},${wallTop + isoUp - 2} ${cx + isoRight + 2},${wallTop} ${cx + isoRight + 2},${wallTop - 2} ${cx},${peakY}" fill="${roof}"/>`;
        // Spire tip
        svg += `<circle cx="${cx}" cy="${peakY - 2}" r="2" fill="${accent}"/>`;
    } else if (shape === 'dome') {
        // Dome roof (library)
        const domeH = 10 + level * 2;
        svg += `<ellipse cx="${cx}" cy="${wallTop - 2}" rx="${footW * 0.35}" ry="${domeH}" fill="${roof}"/>`;
        svg += `<ellipse cx="${cx - 3}" cy="${wallTop - 2}" rx="${footW * 0.32}" ry="${domeH - 1}" fill="${darken(roof, 0.85)}"/>`;
        svg += `<circle cx="${cx}" cy="${wallTop - domeH - 1}" r="2.5" fill="${accent}"/>`;
    } else if (shape === 'flat') {
        // Flat roof with battlements (workshop)
        const ry = wallTop;
        svg += `<polygon points="${cx + isoLeft - 2},${ry} ${cx},${ry + isoUp - 3} ${cx + isoRight + 2},${ry} ${cx + isoRight + 2},${ry - 3} ${cx},${ry + isoUp - 6} ${cx + isoLeft - 2},${ry - 3}" fill="${roof}"/>`;
        // Battlement notches
        for (let b = 0; b < 3; b++) {
            const bx = cx + isoLeft + 4 + b * 8;
            svg += `<rect x="${bx}" y="${ry - 6}" width="3" height="3" fill="${darken(roof, 0.7)}"/>`;
        }
    } else {
        // Gabled roof (default, house)
        const peakY = wallTop - 8 - level * 2;
        // Left roof face
        svg += `<polygon points="${cx + isoLeft - 3},${wallTop + 1} ${cx - 1},${wallTop + isoUp - 1} ${cx - 1},${peakY} ${cx + isoLeft - 3},${peakY + footD / 2}" fill="${darken(roof, 0.8)}"/>`;
        // Right roof face
        svg += `<polygon points="${cx - 1},${wallTop + isoUp - 1} ${cx + isoRight + 3},${wallTop + 1} ${cx + isoRight + 3},${peakY + footD / 2} ${cx - 1},${peakY}" fill="${roof}"/>`;
    }

    // Door on right wall
    const doorW = 5 + level;
    const doorH = 8 + level;
    svg += `<rect x="${cx + 2}" y="${groundY - doorH + isoUp / 2}" width="${doorW}" height="${doorH}" fill="${darken(base, 0.4)}" rx="1"/>`;
    svg += `<rect x="${cx + 3}" y="${groundY - doorH + isoUp / 2 + 1}" width="${doorW - 2}" height="${doorH - 1}" fill="${darken(base, 0.55)}" rx="0.5"/>`;

    // Level-specific decorations
    if (level >= 3) {
        // Chimney smoke placeholder
        svg += `<rect x="${cx + isoRight - 6}" y="${wallTop - 8}" width="4" height="8" fill="${darken(base, 0.5)}" rx="0.5"/>`;
    }
    if (level >= 4) {
        // Flag
        svg += `<line x1="${cx + isoRight - 2}" y1="${wallTop - 12}" x2="${cx + isoRight - 2}" y2="${wallTop - 24}" stroke="#5D4037" stroke-width="1"/>`;
        svg += `<polygon points="${cx + isoRight - 1},${wallTop - 24} ${cx + isoRight + 8},${wallTop - 21} ${cx + isoRight - 1},${wallTop - 18}" fill="${accent}"/>`;
    }

    svg += `</svg>`;
    return svg;
}

function darken(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}

// ─── Terrain tiles with proper isometric diamond shapes ───

function terrainTile(w, h, type) {
    const cx = w / 2, cy = h / 2;
    // Slight overshoot (0.5px) to eliminate sub-pixel gaps between tiles
    const diamond = `${cx},-0.5 ${w + 0.5},${cy} ${cx},${h + 0.5} -0.5,${cy}`;

    const colors = {
        grass:      { fill: '#4a9e2f', edge: '#439425', details: 'grass' },
        grass_dark: { fill: '#449529', edge: '#3b8422', details: 'grass_dark' },
        grass_light:{ fill: '#50a633', edge: '#469c2c', details: 'flowers' },
        water:      { fill: '#2980b9', edge: '#206fa3', details: 'water' },
        water_deep: { fill: '#1f6fa0', edge: '#185d88', details: 'water_deep' },
        path:       { fill: '#c4a882', edge: '#a08866', details: 'path' },
        path_cross: { fill: '#b89b72', edge: '#9a8060', details: 'path_cross' },
        sand:       { fill: '#e8d5a3', edge: '#d4c08a', details: 'sand' },
        stone:      { fill: '#7f8c8d', edge: '#616a6b', details: 'stone' },
        stone_moss: { fill: '#6d8764', edge: '#5a7352', details: 'stone' },
        dirt:       { fill: '#8b6914', edge: '#6d5310', details: 'dirt' },
        bridge:     { fill: '#8B7355', edge: '#6B5335', details: 'bridge' },
    };

    const c = colors[type] || colors.grass;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    // Base diamond
    svg += `<polygon points="${diamond}" fill="${c.fill}"/>`;
    // Edge highlight (top-left)
    svg += `<line x1="${cx}" y1="1" x2="${w - 1}" y2="${cy}" stroke="${c.edge}" stroke-width="0.5" opacity="0.5"/>`;
    // Edge shadow (bottom-right)
    svg += `<line x1="${w - 1}" y1="${cy}" x2="${cx}" y2="${h - 1}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>`;
    svg += `<line x1="${cx}" y1="${h - 1}" x2="1" y2="${cy}" stroke="rgba(0,0,0,0.15)" stroke-width="0.5"/>`;

    // Detail overlays
    if (c.details === 'grass' || c.details === 'grass_dark') {
        // Random grass blades
        for (let i = 0; i < 4; i++) {
            const gx = cx + (Math.random() - 0.5) * w * 0.5;
            const gy = cy + (Math.random() - 0.5) * h * 0.4;
            svg += `<line x1="${gx}" y1="${gy}" x2="${gx - 1}" y2="${gy - 3}" stroke="rgba(0,80,0,0.3)" stroke-width="0.7"/>`;
        }
    } else if (c.details === 'flowers') {
        // Flower dots
        for (let i = 0; i < 3; i++) {
            const fx = cx + (Math.random() - 0.5) * w * 0.4;
            const fy = cy + (Math.random() - 0.5) * h * 0.3;
            const colors = ['#ff6b6b', '#ffd93d', '#a29bfe', '#fd79a8'];
            svg += `<circle cx="${fx}" cy="${fy}" r="1.5" fill="${colors[i % colors.length]}"/>`;
        }
    } else if (c.details === 'water') {
        svg += `<ellipse cx="${cx - 4}" cy="${cy - 1}" rx="8" ry="2" fill="rgba(255,255,255,0.12)"/>`;
        svg += `<ellipse cx="${cx + 6}" cy="${cy + 2}" rx="6" ry="1.5" fill="rgba(255,255,255,0.08)"/>`;
    } else if (c.details === 'water_deep') {
        svg += `<ellipse cx="${cx}" cy="${cy}" rx="10" ry="3" fill="rgba(0,0,0,0.15)"/>`;
    } else if (c.details === 'path') {
        // Cobblestone dots
        for (let i = 0; i < 6; i++) {
            const px = cx + (Math.random() - 0.5) * w * 0.5;
            const py = cy + (Math.random() - 0.5) * h * 0.4;
            svg += `<circle cx="${px}" cy="${py}" r="${0.8 + Math.random()}" fill="rgba(0,0,0,0.08)"/>`;
        }
    } else if (c.details === 'path_cross') {
        svg += `<line x1="${cx - 12}" y1="${cy}" x2="${cx + 12}" y2="${cy}" stroke="rgba(0,0,0,0.08)" stroke-width="4"/>`;
        svg += `<line x1="${cx}" y1="${cy - 6}" x2="${cx}" y2="${cy + 6}" stroke="rgba(0,0,0,0.08)" stroke-width="4"/>`;
    } else if (c.details === 'stone') {
        svg += `<rect x="${cx - 6}" y="${cy - 2}" width="5" height="3" fill="rgba(0,0,0,0.1)" rx="0.5"/>`;
        svg += `<rect x="${cx + 1}" y="${cy}" width="4" height="2.5" fill="rgba(0,0,0,0.08)" rx="0.5"/>`;
    } else if (c.details === 'bridge') {
        svg += `<line x1="${cx - 8}" y1="${cy}" x2="${cx + 8}" y2="${cy}" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>`;
        svg += `<line x1="${cx - 6}" y1="${cy - 3}" x2="${cx + 6}" y2="${cy - 3}" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>`;
    }

    svg += `</svg>`;
    return svg;
}

// ─── Improved decorations ───

function treeSprite(variant) {
    const w = 40, h = 56;
    const cx = w / 2;
    const trunkW = variant === 'pine' ? 3 : 4;
    const trunkH = variant === 'pine' ? h * 0.3 : h * 0.35;
    const trunkY = h - 8;
    const colors = {
        oak:  { trunk: '#5D4037', canopy: ['#2E7D32', '#388E3C', '#1B5E20'] },
        pine: { trunk: '#4E342E', canopy: ['#1B5E20', '#2E7D32', '#0D3B0D'] },
        willow: { trunk: '#6D4C41', canopy: ['#558B2F', '#689F38', '#33691E'] },
        cherry: { trunk: '#5D4037', canopy: ['#C62828', '#E53935', '#B71C1C'] },
    };
    const c = colors[variant] || colors.oak;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += `<ellipse cx="${cx}" cy="${h - 3}" rx="8" ry="4" fill="rgba(0,0,0,0.2)"/>`;
    svg += `<rect x="${cx - trunkW / 2}" y="${trunkY - trunkH}" width="${trunkW}" height="${trunkH}" fill="${c.trunk}" rx="1"/>`;

    if (variant === 'pine') {
        // Layered triangles
        for (let i = 0; i < 3; i++) {
            const ty = trunkY - trunkH + 6 - i * 10;
            const tw = 14 - i * 2;
            svg += `<polygon points="${cx},${ty - 14} ${cx + tw},${ty} ${cx - tw},${ty}" fill="${c.canopy[i]}"/>`;
        }
    } else {
        // Rounded canopy
        svg += `<circle cx="${cx}" cy="${trunkY - trunkH - 4}" r="13" fill="${c.canopy[0]}"/>`;
        svg += `<circle cx="${cx - 7}" cy="${trunkY - trunkH}" r="9" fill="${c.canopy[1]}"/>`;
        svg += `<circle cx="${cx + 6}" cy="${trunkY - trunkH - 2}" r="10" fill="${c.canopy[2]}"/>`;
        // Highlight
        svg += `<circle cx="${cx - 3}" cy="${trunkY - trunkH - 8}" r="5" fill="rgba(255,255,255,0.1)"/>`;
    }

    svg += `</svg>`;
    return svg;
}

function rockSprite(size) {
    const w = 30, h = 24;
    const cx = w / 2, cy = h / 2;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += `<ellipse cx="${cx}" cy="${h - 3}" rx="${6 * size}" ry="${3 * size}" fill="rgba(0,0,0,0.15)"/>`;
    if (size >= 2) {
        svg += `<ellipse cx="${cx - 3}" cy="${cy + 2}" rx="${8}" ry="${5}" fill="#7f8c8d"/>`;
        svg += `<ellipse cx="${cx + 4}" cy="${cy}" rx="${6}" ry="${4}" fill="#95a5a6"/>`;
        svg += `<ellipse cx="${cx - 1}" cy="${cy - 1}" rx="${5}" ry="${3}" fill="#bdc3c7" opacity="0.4"/>`;
    } else {
        svg += `<ellipse cx="${cx}" cy="${cy + 2}" rx="5" ry="3.5" fill="#95a5a6"/>`;
        svg += `<ellipse cx="${cx}" cy="${cy + 1}" rx="3" ry="2" fill="#bdc3c7" opacity="0.3"/>`;
    }
    svg += `</svg>`;
    return svg;
}

function flowerPatch() {
    const w = 32, h = 20;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    const colors = ['#ff6b6b', '#ffd93d', '#a29bfe', '#fd79a8', '#fab1a0', '#81ecec'];
    for (let i = 0; i < 8; i++) {
        const fx = 4 + Math.random() * (w - 8);
        const fy = 4 + Math.random() * (h - 8);
        svg += `<circle cx="${fx}" cy="${fy}" r="2" fill="${colors[i % colors.length]}"/>`;
        svg += `<circle cx="${fx}" cy="${fy}" r="0.8" fill="rgba(255,255,255,0.5)"/>`;
    }
    svg += `</svg>`;
    return svg;
}

function torchSprite() {
    const w = 16, h = 36;
    const cx = w / 2;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    // Post
    svg += `<rect x="${cx - 1.5}" y="${h * 0.3}" width="3" height="${h * 0.65}" fill="#5D4037"/>`;
    svg += `<rect x="${cx - 0.5}" y="${h * 0.3}" width="1" height="${h * 0.65}" fill="#6D4C41"/>`;
    // Flame holder
    svg += `<rect x="${cx - 4}" y="${h * 0.25}" width="8" height="4" fill="#4E342E" rx="1"/>`;
    // Flame
    svg += `<ellipse cx="${cx}" cy="${h * 0.15}" rx="4" ry="7" fill="#FF9800" opacity="0.9"/>`;
    svg += `<ellipse cx="${cx}" cy="${h * 0.13}" rx="2.5" ry="5" fill="#FFB74D"/>`;
    svg += `<ellipse cx="${cx}" cy="${h * 0.11}" rx="1.5" ry="3" fill="#FFF9C4"/>`;
    // Glow
    svg += `<circle cx="${cx}" cy="${h * 0.15}" r="8" fill="rgba(255,152,0,0.15)"/>`;
    svg += `</svg>`;
    return svg;
}

function mushroomSprite() {
    const w = 20, h = 18;
    const cx = w / 2;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += `<rect x="${cx - 1.5}" y="${h * 0.5}" width="3" height="${h * 0.4}" fill="#EFEBE9" rx="0.5"/>`;
    svg += `<ellipse cx="${cx}" cy="${h * 0.45}" rx="7" ry="5" fill="#C62828"/>`;
    svg += `<circle cx="${cx - 3}" cy="${h * 0.38}" r="1.5" fill="rgba(255,255,255,0.7)"/>`;
    svg += `<circle cx="${cx + 2}" cy="${h * 0.42}" r="1" fill="rgba(255,255,255,0.6)"/>`;
    svg += `</svg>`;
    return svg;
}

function fenceSprite() {
    const w = 64, h = 20;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    for (let i = 0; i < 5; i++) {
        const fx = 6 + i * 13;
        svg += `<rect x="${fx}" y="3" width="3" height="${h - 6}" fill="#8D6E63" rx="0.5"/>`;
        svg += `<polygon points="${fx},3 ${fx + 1.5},0 ${fx + 3},3" fill="#6D4C41"/>`;
    }
    svg += `<rect x="6" y="6" width="56" height="2" fill="#795548" rx="0.5"/>`;
    svg += `<rect x="6" y="${h - 7}" width="56" height="2" fill="#795548" rx="0.5"/>`;
    svg += `</svg>`;
    return svg;
}

function cloudSprite() {
    const w = 80, h = 30;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += `<ellipse cx="30" cy="18" rx="22" ry="10" fill="rgba(255,255,255,0.35)"/>`;
    svg += `<ellipse cx="50" cy="15" rx="18" ry="9" fill="rgba(255,255,255,0.3)"/>`;
    svg += `<ellipse cx="20" cy="16" rx="14" ry="7" fill="rgba(255,255,255,0.25)"/>`;
    svg += `<ellipse cx="40" cy="12" rx="15" ry="8" fill="rgba(255,255,255,0.2)"/>`;
    svg += `</svg>`;
    return svg;
}

function scholarSprite() {
    const w = 32, h = 48;
    const cx = w / 2;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    // Shadow
    svg += `<ellipse cx="${cx}" cy="${h - 3}" rx="10" ry="5" fill="rgba(0,0,0,0.2)"/>`;
    // Robe body
    svg += `<path d="M${cx - 9},${h * 0.85} Q${cx - 10},${h * 0.45} ${cx},${h * 0.35} Q${cx + 10},${h * 0.45} ${cx + 9},${h * 0.85} Z" fill="#1A237E"/>`;
    // Robe highlight
    svg += `<path d="M${cx - 5},${h * 0.85} Q${cx - 6},${h * 0.5} ${cx},${h * 0.38} Q${cx + 2},${h * 0.5} ${cx + 1},${h * 0.85} Z" fill="#283593" opacity="0.5"/>`;
    // Belt
    svg += `<rect x="${cx - 7}" y="${h * 0.55}" width="14" height="2" fill="#FFD700" rx="0.5"/>`;
    // Head
    svg += `<circle cx="${cx}" cy="${h * 0.28}" r="7" fill="#FFCC80"/>`;
    // Eyes
    svg += `<circle cx="${cx - 2.5}" cy="${h * 0.27}" r="1" fill="#333"/>`;
    svg += `<circle cx="${cx + 2.5}" cy="${h * 0.27}" r="1" fill="#333"/>`;
    // Beard
    svg += `<ellipse cx="${cx}" cy="${h * 0.35}" rx="4" ry="3" fill="#8D6E63"/>`;
    // Wizard hat
    svg += `<polygon points="${cx},${h * 0.02} ${cx + 11},${h * 0.22} ${cx - 11},${h * 0.22}" fill="#1A237E"/>`;
    svg += `<rect x="${cx - 13}" y="${h * 0.20}" width="26" height="3" fill="#1A237E" rx="1.5"/>`;
    // Star on hat
    svg += `<polygon points="${cx},${h * 0.08} ${cx + 1.5},${h * 0.12} ${cx + 3},${h * 0.12} ${cx + 1.8},${h * 0.15} ${cx + 2.5},${h * 0.19} ${cx},${h * 0.16} ${cx - 2.5},${h * 0.19} ${cx - 1.8},${h * 0.15} ${cx - 3},${h * 0.12} ${cx - 1.5},${h * 0.12}" fill="#FFD700"/>`;
    // Staff
    svg += `<line x1="${cx + 10}" y1="${h * 0.3}" x2="${cx + 12}" y2="${h * 0.82}" stroke="#5D4037" stroke-width="2" stroke-linecap="round"/>`;
    // Staff orb
    svg += `<circle cx="${cx + 10}" cy="${h * 0.28}" r="3" fill="#7C4DFF"/>`;
    svg += `<circle cx="${cx + 10}" cy="${h * 0.28}" r="4.5" fill="rgba(124,77,255,0.2)"/>`;
    svg += `</svg>`;
    return svg;
}

// Wandering villager NPC
function villagerSprite(variant) {
    const w = 24, h = 36;
    const cx = w / 2;
    const robeColors = { farmer: '#558B2F', guard: '#B71C1C', merchant: '#E65100' };
    const robe = robeColors[variant] || '#558B2F';
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += `<ellipse cx="${cx}" cy="${h - 2}" rx="7" ry="3.5" fill="rgba(0,0,0,0.15)"/>`;
    svg += `<path d="M${cx - 6},${h - 4} Q${cx - 7},${h * 0.5} ${cx},${h * 0.4} Q${cx + 7},${h * 0.5} ${cx + 6},${h - 4} Z" fill="${robe}"/>`;
    svg += `<circle cx="${cx}" cy="${h * 0.3}" r="5" fill="#FFCC80"/>`;
    svg += `<circle cx="${cx - 1.5}" cy="${h * 0.29}" r="0.7" fill="#333"/>`;
    svg += `<circle cx="${cx + 1.5}" cy="${h * 0.29}" r="0.7" fill="#333"/>`;
    if (variant === 'farmer') {
        svg += `<rect x="${cx - 8}" y="${h * 0.2}" width="16" height="2" fill="#795548" rx="1"/>`;
    } else if (variant === 'guard') {
        svg += `<polygon points="${cx},${h * 0.12} ${cx + 6},${h * 0.25} ${cx - 6},${h * 0.25}" fill="#616161"/>`;
    }
    svg += `</svg>`;
    return svg;
}

// ─── Generate all assets ───

// Buildings
const buildingDefs = {
    library: { base: '#8B6914', roof: '#B71C1C', accent: '#FFD700', shape: 'dome', label: 'Library' },
    laboratory: { base: '#37474F', roof: '#455A64', accent: '#42A5F5', shape: 'flat', label: 'Lab' },
    tower: { base: '#4A148C', roof: '#6A1B9A', accent: '#CE93D8', shape: 'pointed', label: 'Tower' },
    workshop: { base: '#BF360C', roof: '#8D6E63', accent: '#FF9800', shape: 'flat', label: 'Workshop' },
    castle: { base: '#546E7A', roof: '#78909C', accent: '#FFD700', shape: 'pointed', label: 'Castle' },
    house: { base: '#A1887F', roof: '#6D4C41', accent: '#FFE0B2', shape: 'gabled', label: 'House' },
};

for (const [name, def] of Object.entries(buildingDefs)) {
    const dir = path.join(publicDir, 'buildings', name);
    fs.mkdirSync(dir, { recursive: true });
    for (let lv = 1; lv <= 5; lv++) {
        const svg = isoBuilding(64, 96, { ...def, level: lv });
        fs.writeFileSync(path.join(dir, `lv${lv}.svg`), svg);
    }
    console.log(`Generated ${name} sprites (lv1-lv5)`);
}

// Terrain tiles (expanded set)
const tileTypes = [
    'grass', 'grass_dark', 'grass_light', 'water', 'water_deep',
    'path', 'path_cross', 'sand', 'stone', 'stone_moss', 'dirt', 'bridge'
];
const tileDir = path.join(publicDir, 'tiles');
fs.mkdirSync(tileDir, { recursive: true });
for (const type of tileTypes) {
    fs.writeFileSync(path.join(tileDir, `${type}.svg`), terrainTile(64, 32, type));
}
console.log(`Generated ${tileTypes.length} terrain tile types`);

// Decorations (expanded)
const decoDir = path.join(publicDir, 'decorations');
fs.mkdirSync(decoDir, { recursive: true });
fs.writeFileSync(path.join(decoDir, 'tree_oak.svg'), treeSprite('oak'));
fs.writeFileSync(path.join(decoDir, 'tree_pine.svg'), treeSprite('pine'));
fs.writeFileSync(path.join(decoDir, 'tree_willow.svg'), treeSprite('willow'));
fs.writeFileSync(path.join(decoDir, 'tree_cherry.svg'), treeSprite('cherry'));
fs.writeFileSync(path.join(decoDir, 'tree_01.svg'), treeSprite('oak')); // backwards compat
fs.writeFileSync(path.join(decoDir, 'rock_sm.svg'), rockSprite(1));
fs.writeFileSync(path.join(decoDir, 'rock_lg.svg'), rockSprite(2));
fs.writeFileSync(path.join(decoDir, 'flowers.svg'), flowerPatch());
fs.writeFileSync(path.join(decoDir, 'torch.svg'), torchSprite());
fs.writeFileSync(path.join(decoDir, 'mushroom.svg'), mushroomSprite());
fs.writeFileSync(path.join(decoDir, 'fence.svg'), fenceSprite());
fs.writeFileSync(path.join(decoDir, 'cloud.svg'), cloudSprite());
fs.writeFileSync(path.join(decoDir, 'banner_01.svg'), (() => {
    const w = 40, h = 50, cx = w / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="${cx - 1.5}" y="${h * 0.1}" width="3" height="${h * 0.8}" fill="#795548"/>
  <polygon points="${cx + 1},${h * 0.1} ${cx + 18},${h * 0.2} ${cx + 14},${h * 0.35} ${cx + 18},${h * 0.5} ${cx + 1},${h * 0.4}" fill="#C62828"/>
  <polygon points="${cx + 3},${h * 0.15} ${cx + 14},${h * 0.22} ${cx + 12},${h * 0.32} ${cx + 14},${h * 0.42} ${cx + 3},${h * 0.36}" fill="#E53935"/>
  <circle cx="${cx}" cy="${h * 0.08}" r="3" fill="#FFD700"/>
</svg>`;
})());
fs.writeFileSync(path.join(decoDir, 'fountain_01.svg'), (() => {
    const w = 50, h = 50, cx = w / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <ellipse cx="${cx}" cy="${h * 0.75}" rx="20" ry="10" fill="#607D8B"/>
  <ellipse cx="${cx}" cy="${h * 0.72}" rx="18" ry="8" fill="#546E7A"/>
  <ellipse cx="${cx}" cy="${h * 0.69}" rx="16" ry="7" fill="#42A5F5"/>
  <ellipse cx="${cx - 3}" cy="${h * 0.67}" rx="6" ry="2.5" fill="rgba(255,255,255,0.2)"/>
  <rect x="${cx - 3}" y="${h * 0.3}" width="6" height="${h * 0.4}" fill="#78909C" rx="1"/>
  <ellipse cx="${cx}" cy="${h * 0.28}" rx="8" ry="4" fill="#90A4AE"/>
  <ellipse cx="${cx}" cy="${h * 0.26}" rx="6" ry="3" fill="#42A5F5"/>
  <ellipse cx="${cx}" cy="${h * 0.18}" rx="3" ry="6" fill="#64B5F6" opacity="0.5"/>
  <ellipse cx="${cx}" cy="${h * 0.12}" rx="1.5" ry="4" fill="#90CAF9" opacity="0.3"/>
</svg>`;
})());
console.log('Generated expanded decorations');

// Characters
const charDir = path.join(publicDir, 'characters');
fs.mkdirSync(charDir, { recursive: true });
fs.writeFileSync(path.join(charDir, 'scholar.svg'), scholarSprite());
fs.writeFileSync(path.join(charDir, 'villager_farmer.svg'), villagerSprite('farmer'));
fs.writeFileSync(path.join(charDir, 'villager_guard.svg'), villagerSprite('guard'));
fs.writeFileSync(path.join(charDir, 'villager_merchant.svg'), villagerSprite('merchant'));
console.log('Generated characters (scholar + 3 villagers)');

// UI icons (same as before)
const uiDir = path.join(publicDir, 'ui');
fs.mkdirSync(uiDir, { recursive: true });
const icons = {
    icon_research: [30, 144, 255],
    icon_knowledge: [128, 0, 128],
    icon_reputation: [255, 215, 0],
};
for (const [name, [r, g, b]] of Object.entries(icons)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="10" fill="rgb(${r},${g},${b})" opacity="0.9"/>
  <circle cx="12" cy="12" r="7" fill="rgba(255,255,255,0.25)"/>
  <circle cx="10" cy="10" r="3" fill="rgba(255,255,255,0.15)"/>
</svg>`;
    fs.writeFileSync(path.join(uiDir, `${name}.svg`), svg);
}
console.log('Generated UI icons');

console.log('\nAll V2 assets generated successfully!');
