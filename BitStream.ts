
/**
 * A bit-level stream for reading and writing binary data.
 * Adapted for browser environments using Uint8Array and DataView.
 */
export default class BitStream {
    private buffer: Uint8Array;
    private bitPosition: number; 
    private isWriting: boolean;

    constructor(buffer?: Uint8Array) {
        if (buffer) {
            this.buffer = buffer;
            this.bitPosition = 0;
            this.isWriting = false;
        } else {
            this.buffer = new Uint8Array(1024); // Initial size
            this.bitPosition = 0;
            this.isWriting = true;
        }
    }

    private _ensureCapacity(bitsToWrite: number): void {
        if (!this.isWriting) throw new Error("Cannot write in read mode.");
        const requiredBytes = Math.ceil((this.bitPosition + bitsToWrite) / 8);
        if (requiredBytes > this.buffer.length) {
            let newLength = this.buffer.length * 2;
            while (newLength < requiredBytes) newLength *= 2;
            const newBuffer = new Uint8Array(newLength);
            newBuffer.set(this.buffer);
            this.buffer = newBuffer;
        }
    }

    readUBits(bits: number, changeOffset = true): number {
        if (this.isWriting) throw new Error("Cannot read in write mode.");
        let value = 0;
        for (let i = 0; i < bits; i++) {
            const byteIndex = Math.floor(this.bitPosition / 8);
            const bitInByteIndex = this.bitPosition % 8;

            if (byteIndex >= this.buffer.length) break;
            const currentByte = this.buffer[byteIndex];
            const bit = (currentByte >> (7 - bitInByteIndex)) & 1;

            value = (value << 1) | bit;
            this.bitPosition++;
        }
        if (!changeOffset) this.bitPosition -= bits;
        return value >>> 0;
    }

    writeUBits(value: number, bits: number): void {
        this._ensureCapacity(bits);
        for (let i = bits - 1; i >= 0; i--) {
            const byteIndex = Math.floor(this.bitPosition / 8);
            const bitInByteIndex = this.bitPosition % 8;
            const bit = (value >> i) & 1;
            const currentByte = this.buffer[byteIndex];
            this.buffer[byteIndex] = (currentByte & ~(1 << (7 - bitInByteIndex))) | (bit << (7 - bitInByteIndex));
            this.bitPosition++;
        }
    }

    readUInt8(changeOffset = true): number { return this.readUBits(8, changeOffset); }
    writeUInt8(value: number): void { this.writeUBits(value, 8); }

    readInt8(changeOffset = true): number {
        const unsigned = this.readUBits(8, changeOffset);
        return (unsigned << 24) >> 24;
    }
    writeInt8(value: number): void { this.writeUBits(value, 8); }

    readUInt16(changeOffset = true): number {
        const byte0 = this.readUBits(8);
        const byte1 = this.readUBits(8);
        if (!changeOffset) this.bitPosition -= 16;
        return byte0 | (byte1 << 8);
    }
    writeUInt16(value: number): void {
        this.writeUBits(value & 0xFF, 8);
        this.writeUBits((value >> 8) & 0xFF, 8);
    }

    readInt16(changeOffset = true): number {
        const unsigned = this.readUInt16(changeOffset);
        return (unsigned << 16) >> 16;
    }
    writeInt16(value: number): void { this.writeUInt16(value); }

    readUInt32(changeOffset = true): number {
        const b0 = this.readUBits(8);
        const b1 = this.readUBits(8);
        const b2 = this.readUBits(8);
        const b3 = this.readUBits(8);
        if (!changeOffset) this.bitPosition -= 32;
        return (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
    }
    writeUInt32(value: number): void {
        this.writeUBits(value & 0xFF, 8);
        this.writeUBits((value >> 8) & 0xFF, 8);
        this.writeUBits((value >> 16) & 0xFF, 8);
        this.writeUBits((value >> 24) & 0xFF, 8);
    }

    readFloat32(changeOffset = true): number {
        const temp = new Uint8Array(4);
        for (let i = 0; i < 4; i++) temp[i] = this.readUBits(8);
        if (!changeOffset) this.bitPosition -= 32;
        return new DataView(temp.buffer).getFloat32(0, true);
    }
    writeFloat32(value: number): void {
        const temp = new Uint8Array(4);
        new DataView(temp.buffer).setFloat32(0, value, true);
        for (let i = 0; i < 4; i++) this.writeUBits(temp[i], 8);
    }

    readString8(changeOffset = true): string {
        const charCode = this.readUBits(8);
        if (!changeOffset) this.bitPosition -= 8;
        return String.fromCharCode(charCode);
    }
    writeString8(str: string): void {
        this.writeUBits(str.charCodeAt(0) || 0, 8);
    }

    readString32(changeOffset = true): string {
        let result = '';
        for (let i = 0; i < 4; i++) result += this.readString8();
        if (!changeOffset) this.bitPosition -= 32;
        return result;
    }
    writeString32(str: string): void {
        for (let i = 0; i < 4; i++) this.writeString8(str[i] || '\0');
    }

    readString32Array(length: number): string[] {
        const arr = [];
        for (let i = 0; i < length; i++) arr.push(this.readString32());
        return arr;
    }
    writeString32Array(arr: string[]): void {
        for (const str of arr) this.writeString32(str);
    }

    getBuffer(): Uint8Array {
        if (!this.isWriting) throw new Error("Cannot get buffer in read mode.");
        return this.buffer.slice(0, Math.ceil(this.bitPosition / 8));
    }
}
