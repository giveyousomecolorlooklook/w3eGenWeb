
import BitStream from "./BitStream";

export interface W3E {
    header: {
        fileId: string;
        version: number;
        baseTileset: string;
        hasCustomTileset: number;
        tilePaletteCount: number;
        tilePalette: string[];
        cliffTilePaletteCount: number;
        cliffTilePalette: string[];
        width: number;
        height: number;
        x: number;
        y: number;
    };
    corners: Corner[];
}

export interface Corner {
    index: number;
    rowid: number;
    colid: number;
    groundHeight: number;
    waterHeight: number;
    mapEdge: number; // 2 bits
    ramp: number;    // 1 bit
    blight: number;  // 1 bit
    water: number;   // 1 bit
    boundary: number;// 1 bit
    groundTexture: number;   // 4 bits
    groundVariation: number; // 5 bits
    cliffVariation: number;  // 3 bits
    cliffTexture: number;    // 4 bits
    layerHeight: number;     // 4 bits
}

export default class TerrainUtil {
    static generateEmptyW3e(width: number, height: number, tileset: string = 'O'): W3E {
        const w3e: W3E = {
            header: {
                fileId: "W3ER",
                version: 11,
                baseTileset: tileset,
                hasCustomTileset: 0,
                tilePaletteCount: 1,
                tilePalette: ["Oaby"], // Default dirt for Lordaeron Summer
                cliffTilePaletteCount: 1,
                cliffTilePalette: ["Oclm"],
                width: width,
                height: height,
                x: -Math.floor(width / 2) * 128,
                y: -Math.floor(height / 2) * 128
            },
            corners: []
        };

        for (let i = 0; i < width * height; i++) {
            const row = Math.floor(i / width);
            const col = i % width;
            w3e.corners.push({
                index: i,
                rowid: row,
                colid: col,
                groundHeight: 0,
                waterHeight: 0,
                mapEdge: 0,
                groundTexture: 0,
                ramp: 0,
                water: 0,
                blight: 0,
                boundary: 0,
                groundVariation: 0,
                cliffVariation: 0,
                cliffTexture: 0,
                layerHeight: 2
            });
        }
        return w3e;
    }

    static decodeW3e(buffer: Uint8Array): W3E {
        const bitstream = new BitStream(buffer);

        const fileId = bitstream.readString32();
        const version = bitstream.readUInt32();
        const baseTileset = bitstream.readString8();
        const hasCustomTileset = bitstream.readUInt32();
        
        const tilePaletteCount = bitstream.readUInt32(); 
        const tilePalette = bitstream.readString32Array(tilePaletteCount);
        
        const cliffTilePaletteCount = bitstream.readUInt32();
        const cliffTilePalette = bitstream.readString32Array(cliffTilePaletteCount);

        const width = bitstream.readUInt32();
        const height = bitstream.readUInt32();
        const x = bitstream.readFloat32();
        const y = bitstream.readFloat32();

        const w3e: W3E = {
            header: {
                fileId, version, baseTileset, hasCustomTileset,
                tilePaletteCount, tilePalette,
                cliffTilePaletteCount, cliffTilePalette,
                width, height, x, y
            },
            corners: [],
        };

        const totalCorners = width * height;
        for (let i = 0; i < totalCorners; i++) {
            const row = Math.floor(i / width);
            const col = i % width;

            const gHeight = bitstream.readUInt16();
            const wHeightRaw = bitstream.readUInt16();
            
            const byte4 = bitstream.readUInt8();
            const byte5 = bitstream.readUInt8();
            const byte6 = bitstream.readUInt8();
            
            w3e.corners.push({
                index: i,
                rowid: row,
                colid: col,
                groundHeight: (gHeight - 8192) / 4,
                waterHeight: ((wHeightRaw & 0x3FFF) - 8192) / 4,
                mapEdge: (wHeightRaw & 0xC000) >>> 14,
                
                groundTexture: byte4 & 0x0F,
                ramp: (byte4 & 0x10) >> 4,
                water: (byte4 & 0x20) >> 5,
                blight: (byte4 & 0x40) >> 6,
                boundary: (byte4 & 0x80) >> 7,
                
                groundVariation: byte5 & 0x1F,
                cliffVariation: (byte5 & 0xE0) >> 5,
                
                cliffTexture: byte6 & 0x0F,
                layerHeight: (byte6 & 0xF0) >> 4
            });
        }
        return w3e;
    }

    static encodeW3e(w3e: W3E): Uint8Array {
        const bitstream = new BitStream();
        bitstream.writeString32(w3e.header.fileId);
        bitstream.writeUInt32(w3e.header.version);
        bitstream.writeString8(w3e.header.baseTileset);
        bitstream.writeUInt32(w3e.header.hasCustomTileset);
        bitstream.writeUInt32(w3e.header.tilePaletteCount);
        bitstream.writeString32Array(w3e.header.tilePalette);
        bitstream.writeUInt32(w3e.header.cliffTilePaletteCount);
        bitstream.writeString32Array(w3e.header.cliffTilePalette);
        bitstream.writeUInt32(w3e.header.width);
        bitstream.writeUInt32(w3e.header.height);
        bitstream.writeFloat32(w3e.header.x);
        bitstream.writeFloat32(w3e.header.y);

        for (const corner of w3e.corners) {
            bitstream.writeUInt16(Math.round(corner.groundHeight * 4 + 8192));
            
            const wHeightRaw = (Math.round(corner.waterHeight * 4 + 8192) & 0x3FFF) | (corner.mapEdge << 14);
            bitstream.writeUInt16(wHeightRaw);

            const byte4 = (corner.groundTexture & 0x0F) |
                          (corner.ramp << 4) |
                          (corner.water << 5) |
                          (corner.blight << 6) |
                          (corner.boundary << 7);
            bitstream.writeUInt8(byte4);

            const byte5 = (corner.groundVariation & 0x1F) | (corner.cliffVariation << 5);
            bitstream.writeUInt8(byte5);

            const byte6 = (corner.cliffTexture & 0x0F) | (corner.layerHeight << 4);
            bitstream.writeUInt8(byte6);
        }

        return bitstream.getBuffer();
    }
}
