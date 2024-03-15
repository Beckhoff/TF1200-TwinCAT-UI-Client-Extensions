import { IDeviceConnection, ConnectionError } from "../RFIDCommunication";
import os = require("os");
import path = require("path");
import koffi = require("koffi");

// This module uses the 'koffi' foreign function interface to call functions
// from a DLL written in C++. First, the system architecture is determined.
// Then, the correct DLL is loaded and the function definitions are created.

const isx64 = os.arch() === "x64";
const isx86 = os.arch() === "ia32";

if (os.platform() !== "win32" && (isx64 || isx86)) {
    const err = new Error("Only x86 or x64 based windows systems are supported");
    err.name = "ERR_FEATURE_UNAVAILABLE_ON_PLATFORM";
    throw err;
}

export class IDTRONICCom implements IDeviceConnection {
    private handle: koffi.IKoffiCType;
    private api: {
        GetSysComm: koffi.KoffiFunction;
        OpenComm: koffi.KoffiFunction;
        CloseComm: koffi.KoffiFunction;
        MF_GET_SNR: koffi.KoffiFunction;
        MF_Read: koffi.KoffiFunction;
    };

    constructor() {
        const dllName = path.join(".", "bin", `iDTRONIC${isx64 ? "x64" : ""}.dll`);
        const dll = koffi.load(dllName);
        this.api = {
            GetSysComm: dll.func("int API_GetSysComm(unsigned char*)"),
            OpenComm: dll.func("HANDLE API_OpenComm(int, int)"),
            CloseComm: dll.func("int API_CloseComm(HANDLE)"),
            MF_GET_SNR: dll.func("int API_MF_GET_SNR(HANDLE, int, unsigned char, unsigned char, unsigned char*)"),
            MF_Read: dll.func("int API_MF_Read(HANDLE, int, unsigned char, unsigned char, unsigned char, unsigned char*, unsigned char*)")
        };
    }

    listComPorts(): Uint8Array {
        const buffer = new Uint8Array(257);
        const ret = this.api.GetSysComm(buffer);

        if (ret) {
            throw new Error(ret);
        }

        // buffer[0] contains the length of the returned data
        return buffer.subarray(1, buffer[0] + 1);
    }

    open(comPort: number) {
        if (this.handle) {
            this.close();
        }

        this.handle = this.api.OpenComm(comPort, 9600);

        if (!this.handle) {
            throw new ConnectionError(`Unable to open COM${comPort}`);
        }
    }

    close(): void {
        this.api.CloseComm(this.handle);
    }

    readSerialNumber(): false | string {
        const buffer = new Uint8Array(16);
        const ret = this.api.MF_GET_SNR(this.handle, 0x00, 0x26, 0x00, buffer);

        if (ret) {
            // 1: No card detected
            if (ret === 1) {
                return false;
            }

            // 4: Connection error
            if (ret === 4) {
                throw new ConnectionError("Connection lost while reading serial number");
            }
        }

        // Get variable length uid from buffer and reverse endianness
        const uidBuffer = buffer.subarray(2, buffer[0] + 1).reverse();
        // Convert Bytes to hex string
        const uidString = uidBuffer.reduce((acc, cur) => acc += cur.toString(16).padStart(2, "0"), "");
        return uidString;
    }
}
