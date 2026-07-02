import { TcUiClientExt, MenuItemConstructor } from "@beckhoff/tc-ui-client-ext";
import fs = require("fs");
import { validate } from "jsonschema";
import { RFIDLogic } from "./RFIDLogic";
import { IDeviceConnection } from "./RFIDCommunication";
import ReaderImplementations = require("./ReaderImpl/index");

class RFIDAuth extends TcUiClientExt {

    /**  The settings saved in settings.json */
    private settings!: SettingsStore;

    /** Information about the device error state */
    private deviceError = {
        /** If false, the error won't be shown in the TwinCAT UI Client */
        show: true,
        /** True, if the device currently has an error */
        active: false,
        /** False, if the error has not been acknowledged yet */
        acknowledged: false
    };

    private rfidCom!: IDeviceConnection;
    private rfidLogic!: RFIDLogic;

    private changeComPort(comPort: string): void {
        // Get the number of the COM port from the string (e.g. "COM3" => 3)
        this.settings.set("comPort", Number(comPort[3]));
        // Open a connection to the COM port and start polling the RFID reader for UIDs
        this.rfidLogic.start(this.settings.get("comPort"));
        // Reset a possible error
        this.deviceError.active = false;
    }
    
    private getCurrentUid(): { uid: string } | { error: { message: string, details: string, code: string } } {
        try {
            const uid = this.rfidCom.readSerialNumber(true);

            if (!uid) {
                return { error: { message: "No card detected", details: "", code: "RFID_NO_CARD_DETECTED" } };
            }

            return { uid };
        } catch (err) {
            const errorObj = { error: { message: "There was an error while reading the serial number", details: "", code: "" } };
            if (err instanceof Error) {
                errorObj.error.details = err.message;
                errorObj.error.code = err.name;
            }
            return errorObj;
        }
    }

    async onStartup(): Promise<void> {
        // Read settings from settings.json and validate against settings.Schema.json
        this.settings = SettingsStore.fromFile("settings.json", "settings.Schema.json");

        // Create an instance of a ReaderImplementation depending on the deviceType
        const deviceTypeLower = this.settings.get("deviceType").toLowerCase();
        switch (deviceTypeLower) {
        case "eks":
            this.rfidCom = new ReaderImplementations.EKSCom();
            break;
        case "idtronic":
            this.rfidCom = new ReaderImplementations.IDTRONICCom();
            break;
        case "baltech":
            this.rfidCom = new ReaderImplementations.Baltech();
            // This option is not compatible with an Baltech reader.
            this.settings.set("logoutOnCardRemoved", false);
            this.changeMenuItemProperty("logoutOnCardRemoved", {
                enabled: false
            });
            break;
        default:
            throw new Error(`Reader type "${this.settings.get("deviceType")}" is not supported`);
        }

        // Create RFIDLogic object. It handles polling of the Reader and errors.
        this.rfidLogic = new RFIDLogic(this.rfidCom);
        // Push an update handler to the RFIDLogic object. It is called when a card is removed
        // or a new card is detected.
        this.rfidLogic.addUpdateHandler(uid => {
            if (uid && this.settings.get("loginWhenCardDetected")) {
                this.emit("login", {
                    uid,
                    domain: this.settings.get("loginDomain")
                });
            } else if (!uid && this.settings.get("logoutOnCardRemoved")) {
                this.emit("logout", null);
            }
        });

        // Add an error handler. This is called when a connection error occurs.
        this.rfidLogic.onDeviceError = (() => {
            this.deviceError.acknowledged = false;
            this.deviceError.active = true;
            if (this.deviceError.show) {
                this.emit("showDeviceError", { comPort: this.settings.get("comPort") });
            }
        }).bind(this);

        // Start polling with the RFIDLogic instance
        this.rfidLogic.start(this.settings.get("comPort"));

        // Get a list of available COM ports and display them in the application menu
        const comPorts = await this.rfidCom.listComPorts();
        if (comPorts) {
            const comPortMenuItems = Array.from(comPorts).map(value => {
                return {
                    label: `COM${value}`,
                    click: "changeComPort",
                    type: "radio",
                    checked: this.settings.get("comPort") === value
                } as MenuItemConstructor;
            });
            this.changeMenuItemProperty("comPorts", {
                submenu: comPortMenuItems
            });
        }

        // Toggle the checkbox values according to the value in the settings.json
        this.changeMenuItemProperty("logoutOnCardRemoved", {
            checked: this.settings.get("logoutOnCardRemoved")
        });

        this.changeMenuItemProperty("loginWhenCardDetected", {
            checked: this.settings.get("loginWhenCardDetected")
        });
    }

    onMessage(command: string, args: any): any {
        switch (command) {
        // Application menu callbacks
        case "changeComPort":
            return this.changeComPort(args.label);
        case "changeLogoutOnCardRemoved":
            this.settings.set("logoutOnCardRemoved", args.checked);
            return;
        case "changeLoginWhenCardDetected":
            this.settings.set("loginWhenCardDetected", args.checked);
            return;
        case "gotoUserConfiguration":
            this.emit("gotoUserConfiguration", this.settings.get("loginDomain"));
            return;

        // This message is sent by the config page when configuring new users
        case "getCurrentUid":
            return this.getCurrentUid();
        // This message is sent by the renderer process to display device errors
        case "getNonAcknowledgedDeviceError":
            if (this.deviceError.active && !this.deviceError.acknowledged && this.deviceError.show) {
                this.emit("showDeviceError", { comPort: this.settings.get("comPort") });
            }
            return;
        // This message is sent by the renderer process when a device error is acknowledged by the user
        case "acknowledgeDeviceError":
            if (args?.doNotShowAgain) this.deviceError.show = false;
            this.deviceError.acknowledged = true;
            return;

        }
    }
}

interface RFIDSettings {
    comPort: number;
    logoutOnCardRemoved: boolean;
    loginWhenCardDetected: boolean;
    loginDomain: string;
    deviceType: "EKS" | "iDTRONIC" | "Baltech";
}

/**
 * A class that handles reading and writing of the settings.json file.
 * Any update to the settings is immediately written to the file.
 */
class SettingsStore {
    public constructor(
        private readonly filePath: string,
        private readonly settings: RFIDSettings
    ) {}

    public get<K extends keyof RFIDSettings>(key: K): RFIDSettings[K] {
        return this.settings[key];
    }

    public set<K extends keyof RFIDSettings>(key: K, value: RFIDSettings[K]): void {
        this.settings[key] = value;
        fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 4));
    }

    public static fromFile(filePath: string, schemaPath: string): SettingsStore {
        const settingsSchema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
        const settings = JSON.parse(fs.readFileSync(filePath, "utf-8"));

        if (!validate(settings, settingsSchema).valid) {
            throw new Error("The settings file doesn't match the schema and is invalid");
        }

        return new SettingsStore(filePath, settings);
    }
}

export = RFIDAuth;
