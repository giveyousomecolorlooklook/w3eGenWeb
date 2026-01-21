
import React, { useState, useRef, useEffect, useCallback } from 'react';
import TerrainUtil, { W3E } from './TerrainUtil';

interface ColorMapping {
    slotIndex: number;
    color: string;
    active: boolean;
    textureId?: string;
}

// 按照用户要求的顺序设置默认颜色和对应的纹理名称
const INITIAL_PALETTE = [
    { id: "Oaby", color: "#000000", label: "黑色" },
    { id: "Orok", color: "#1a1a1a", label: "黑色" },
    { id: "Zdrt", color: "#8b4513", label: "泥土色" },
    { id: "Zdtr", color: "#5d2906", label: "深色泥土" },
    { id: "Osmb", color: "#704214", label: "褐色" },
    { id: "Zdrg", color: "#228b22", label: "草色" },
    { id: "Zsan", color: "#edc9af", label: "沙漠色" },
    { id: "Zbks", color: "#4b5320", label: "苔藓色" },
    { id: "Zbkl", color: "#808080", label: "灰砖色" },
    { id: "Ztil", color: "#2f4f4f", label: "绿砖色" },
    { id: "Ywmb", color: "#dcdcdc", label: "白砖色" },
    { id: "Dlav", color: "#ff0000", label: "红色" },
    { id: "Dlvc", color: "#8b0000", label: "深红" },
    { id: "Iice", color: "#ffffff", label: "雪白" },
    { id: "Idki", color: "#008b8b", label: "深青色" },
    { id: "Itbk", color: "#004d4d", label: "更加深的青" }
];

const App: React.FC = () => {
    const [terrain, setTerrain] = useState<W3E | null>(null);
    const [selectedTexture, setSelectedTexture] = useState<number>(0);
    const [brushSize, setBrushSize] = useState<number>(1);
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{type: 'info' | 'warn', text: string} | null>(null);
    
    const [mappings, setMappings] = useState<ColorMapping[]>(
        Array.from({ length: 16 }, (_, i) => ({ 
            slotIndex: i, 
            color: INITIAL_PALETTE[i].color, 
            active: false, // 默认不勾选
            textureId: INITIAL_PALETTE[i].id
        }))
    );
    
    const [pickingSlot, setPickingSlot] = useState<number | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageCanvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);

    const showStatus = (text: string, type: 'info' | 'warn' = 'info') => {
        setStatusMsg({ text, type });
        setTimeout(() => setStatusMsg(null), 5000);
    };

    const renderTerrain = useCallback((w3e: W3E) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const cellSize = 8;
        canvas.width = w3e.header.width * cellSize;
        canvas.height = w3e.header.height * cellSize;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let row = 0; row < w3e.header.height; row++) {
            for (let col = 0; col < w3e.header.width; col++) {
                const index = row * w3e.header.width + col;
                const corner = w3e.corners[index];
                const color = mappings[corner.groundTexture % 16].color;
                ctx.fillStyle = color;
                ctx.fillRect(
                    col * cellSize, 
                    (w3e.header.height - 1 - row) * cellSize, 
                    cellSize, 
                    cellSize
                );
            }
        }
    }, [mappings]);

    useEffect(() => {
        if (sourceImage && imageCanvasRef.current) {
            const canvas = imageCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = sourceImage.width;
            canvas.height = sourceImage.height;
            ctx.drawImage(sourceImage, 0, 0);
        }
    }, [sourceImage]);

    useEffect(() => {
        if (terrain) renderTerrain(terrain);
    }, [terrain, renderTerrain]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                setSourceImage(img);
                showStatus("Image ready");
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleImageCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (pickingSlot === null || !imageCanvasRef.current) return;
        
        const canvas = imageCanvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
        const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
        
        const ctx = canvas.getContext('2d');
        if (!ctx || x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;
        
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const hex = "#" + ("000000" + ((pixel[0] << 16) | (pixel[1] << 8) | pixel[2]).toString(16)).slice(-6);
        
        const newMappings = [...mappings];
        newMappings[pickingSlot] = { ...newMappings[pickingSlot], color: hex };
        setMappings(newMappings);
        setPickingSlot(null);
        showStatus(`Slot ${pickingSlot} updated`);
    };

    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    };

    const applyImageToTerrain = () => {
        if (!terrain || !sourceImage || !imageCanvasRef.current) return;
        
        const activeMappings = mappings.filter(m => m.active).map(m => ({
            ...m,
            rgb: hexToRgb(m.color)
        }));

        if (activeMappings.length === 0) {
            showStatus("No active slots selected!", "warn");
            return;
        }

        setLoading(true);

        const { width, height } = terrain.header;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = width;
        offCanvas.height = height;
        const offCtx = offCanvas.getContext('2d');
        if (!offCtx) return;

        offCtx.drawImage(sourceImage, 0, 0, width, height);
        const imgData = offCtx.getImageData(0, 0, width, height).data;

        const newTerrain = { ...terrain };
        const corners = [...newTerrain.corners];

        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const imgRow = (height - 1) - row;
                const pixelIndex = (imgRow * width + col) * 4;
                const r = imgData[pixelIndex];
                const g = imgData[pixelIndex + 1];
                const b = imgData[pixelIndex + 2];

                let minDistance = Infinity;
                let bestSlot = corners[row * width + col].groundTexture;

                for (const m of activeMappings) {
                    const dr = r - m.rgb.r;
                    const dg = g - m.rgb.g;
                    const db = b - m.rgb.b;
                    const dist = dr * dr + dg * dg + db * db;
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestSlot = m.slotIndex;
                    }
                }
                corners[row * width + col] = { ...corners[row * width + col], groundTexture: bestSlot };
            }
        }

        setTerrain({ ...newTerrain, corners });
        setLoading(false);
        showStatus("Mapped to grid");
    };

    const handleTerrainPaint = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!terrain || e.buttons !== 1) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const cellSize = 8;
        const col = Math.floor(((e.clientX - rect.left) * (canvas.width / rect.width)) / cellSize);
        const row = (terrain.header.height - 1) - Math.floor(((e.clientY - rect.top) * (canvas.height / rect.height)) / cellSize);
        
        if (col >= 0 && col < terrain.header.width && row >= 0 && row < terrain.header.height) {
            const newTerrain = { ...terrain };
            const corners = [...newTerrain.corners];
            const halfBrush = Math.floor(brushSize / 2);
            let modified = false;

            for (let dy = -halfBrush; dy <= halfBrush; dy++) {
                for (let dx = -halfBrush; dx <= halfBrush; dx++) {
                    const tc = col + dx;
                    const tr = row + dy;
                    if (tc >= 0 && tc < terrain.header.width && tr >= 0 && tr < terrain.header.height) {
                        const idx = tr * terrain.header.width + tc;
                        if (corners[idx].groundTexture !== selectedTexture) {
                            corners[idx] = { ...corners[idx], groundTexture: selectedTexture };
                            modified = true;
                        }
                    }
                }
            }
            if (modified) setTerrain({ ...newTerrain, corners });
        }
    };

    return (
        <div className="flex flex-col h-screen p-4 gap-4 overflow-hidden bg-gray-950 text-gray-100 font-sans">
            <header className="flex items-center justify-between bg-gray-900 p-4 rounded-2xl border border-white/5 shadow-2xl relative shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-xl font-black bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent uppercase tracking-tight">W3E Texturizer Pro</h1>
                    <p className="text-[9px] font-bold text-blue-500/60 uppercase tracking-widest">Default Palette System</p>
                </div>

                {statusMsg && (
                    <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 px-6 py-2 rounded-xl text-[10px] font-black shadow-2xl border bg-blue-500/10 text-blue-400 border-blue-500/20 backdrop-blur-md z-50 animate-in fade-in slide-in-from-top-2">
                        {statusMsg.text}
                    </div>
                )}

                <div className="flex gap-2">
                    <input type="file" ref={fileInputRef} accept=".w3e" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = async (ev) => {
                                const decoded = TerrainUtil.decodeW3e(new Uint8Array(ev.target?.result as ArrayBuffer));
                                setTerrain(decoded);
                                showStatus("Map Loaded");
                            };
                            reader.readAsArrayBuffer(file);
                        }
                    }} className="hidden" />
                    <input type="file" ref={imageInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
                    
                    <button onClick={() => fileInputRef.current?.click()} className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest transition-all">Import W3E</button>
                    <button onClick={() => imageInputRef.current?.click()} className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest transition-all">Import PNG</button>
                    
                    {terrain && sourceImage && (
                        <button onClick={applyImageToTerrain} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 transition-all">Apply Mapping</button>
                    )}
                    
                    {terrain && (
                        <button onClick={async () => {
                            const encoded = TerrainUtil.encodeW3e(terrain);
                            const blob = new Blob([encoded], { type: 'application/octet-stream' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'modified.w3e';
                            a.click();
                        }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Export</button>
                    )}
                </div>
            </header>

            <main className="flex flex-1 gap-4 overflow-hidden">
                <div className="flex-1 flex gap-4 overflow-hidden min-w-0">
                    <div className="flex-1 bg-gray-900 rounded-3xl border border-white/5 shadow-inner flex flex-col overflow-hidden relative">
                        <div className="p-3 border-b border-white/5 flex justify-between items-center bg-black/20 shrink-0">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Terrain Grid</span>
                            {terrain && <span className="text-[8px] font-mono text-gray-600">{terrain.header.width}x{terrain.header.height}</span>}
                        </div>
                        <div className="flex-1 overflow-hidden p-4 flex items-center justify-center bg-black/10">
                            {terrain ? (
                                <canvas 
                                    ref={canvasRef} 
                                    onMouseDown={handleTerrainPaint} 
                                    onMouseMove={handleTerrainPaint} 
                                    className="max-w-full max-h-full shadow-2xl border border-white/10 object-contain bg-black" 
                                    style={{ imageRendering: 'pixelated' }} 
                                />
                            ) : (
                                <div className="text-gray-800 text-[10px] font-black uppercase tracking-widest animate-pulse">Waiting for W3E...</div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 bg-gray-900 rounded-3xl border border-white/5 shadow-inner flex flex-col overflow-hidden relative">
                        <div className="p-3 border-b border-white/5 flex justify-between items-center bg-black/20 shrink-0">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Ref Image</span>
                            {pickingSlot !== null && <span className="text-[8px] font-black text-blue-500 animate-pulse uppercase">Picking Color...</span>}
                        </div>
                        <div className="flex-1 overflow-hidden p-4 flex items-center justify-center bg-black/10">
                            {sourceImage ? (
                                <canvas 
                                    ref={imageCanvasRef} 
                                    onClick={handleImageCanvasClick} 
                                    className={`max-w-full max-h-full shadow-2xl border border-white/10 object-contain ${pickingSlot !== null ? 'cursor-crosshair ring-2 ring-blue-500 ring-offset-4 ring-offset-gray-950' : ''}`} 
                                />
                            ) : (
                                <div className="text-gray-800 text-[10px] font-black uppercase tracking-widest animate-pulse">Waiting for Image...</div>
                            )}
                        </div>
                    </div>
                </div>

                <aside className="w-80 shrink-0 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-gray-900 rounded-3xl border border-white/5 p-6 shadow-2xl flex flex-col h-full overflow-hidden">
                        <header className="mb-4 shrink-0">
                            <h2 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em]">Texture Palette</h2>
                            <div className="h-px w-full bg-white/5 mt-3"></div>
                        </header>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                            {mappings.map((m, i) => (
                                <div 
                                    key={i} 
                                    onClick={() => setSelectedTexture(i)}
                                    className={`group flex items-center gap-3 p-2 rounded-xl transition-all border cursor-pointer
                                        ${selectedTexture === i ? 'bg-white/10 border-white/20 shadow-lg' : 'bg-black/20 border-transparent hover:border-white/5'}
                                        ${pickingSlot === i ? 'ring-2 ring-blue-500 bg-blue-500/5' : ''}`}
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={m.active} 
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                            const newMap = [...mappings];
                                            newMap[i].active = e.target.checked;
                                            setMappings(newMap);
                                        }} 
                                        className="rounded border-white/10 bg-transparent text-blue-500 w-3 h-3 cursor-pointer" 
                                    />
                                    
                                    <div className="relative shrink-0">
                                        <div 
                                            className="w-8 h-8 rounded-lg border border-white/10 shadow-inner" 
                                            style={{ backgroundColor: m.color }}
                                        >
                                            <input 
                                                type="color" 
                                                value={m.color} 
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => {
                                                    const newMap = [...mappings];
                                                    newMap[i].color = e.target.value;
                                                    setMappings(newMap);
                                                }}
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[8px] font-black text-gray-400 uppercase">Slot {i} - {INITIAL_PALETTE[i].label}</span>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold text-gray-200 truncate uppercase tracking-tighter">
                                            {terrain?.header.tilePalette[i] || m.textureId}
                                        </span>
                                    </div>

                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPickingSlot(pickingSlot === i ? null : i);
                                        }}
                                        className={`p-1.5 rounded-lg transition-colors shrink-0 ${pickingSlot === i ? 'bg-blue-500 text-white shadow-lg' : 'bg-white/5 text-gray-600 hover:text-white hover:bg-white/10'}`}
                                        title="Pick from image"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/5 shrink-0">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Brush: {brushSize}</span>
                            </div>
                            <input type="range" min="1" max="9" step="2" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-1 bg-black rounded-lg appearance-none cursor-pointer accent-blue-500" />
                        </div>
                    </div>
                </aside>
            </main>

            <footer className="px-2 flex items-center justify-between opacity-20 shrink-0">
                <div className="text-[7px] font-black uppercase tracking-[0.4em]">Grid: Bottom-Left Context</div>
                <div className="text-[7px] font-black uppercase tracking-[0.4em]">V3.4 // Optimized Palette</div>
            </footer>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 10px; width: 10px; border-radius: 100%; background: #3b82f6; cursor: pointer; border: 2px solid #fff; }
            `}</style>
        </div>
    );
};

export default App;
