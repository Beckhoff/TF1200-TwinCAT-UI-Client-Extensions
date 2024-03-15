import { TcUiClientExt, MenuItemConstructor } from "@beckhoff/tc-ui-client-ext";
import fs = require("fs");
import { validate } from "jsonschema";
import { RFIDLogic } from "./RFIDLogic";
import { IDeviceConnection } from "./RFIDCommunication";
import ReaderImplementations = require("./ReaderImpl/index");

class RFIDAuth extends TcUiClientExt {

    /**
     * The settings saved in settings.json
     */
    private settings: {
        comPort: number;
        logoutOnCardRemoved:boolean;
        loginWhenCardDetected: boolean;
        loginDomain: string;
        deviceType: "EKS" | "iDTRONIC" | "Baltech";
    };

    /**
     * Information about the device error state
     */
    private deviceError = {
        /** If false, the error won't be shown in the TwinCAT UI Client */
        show: true,
        /** True, if the device currently has an error */
        active: false,
        /** False, if the error has not been acknowledged yet */
        acknowledged: false
    };

    private rfidCom: IDeviceConnection;
    private rfidLogic: RFIDLogic;

    private changeComPort(comPort: string): void {
        // Get the number of the COM port from the string (e.g. "COM3" => 3)
        this.settings.comPort = Number(comPort[3]);
        // Open a connection to the COM port and start polling the RFID reader for UIDs
        this.rfidLogic.start(this.settings.comPort);
        // Reset a possible error
        this.deviceError.active = false;
    }

    private getCurrentUid(): { uid?: string, error?: { message: string, details: string, code: string } } {
        try {
            const uid = this.rfidCom.readSerialNumber(true);

            if (!uid) {
                return { error: { message: "No card detected", details: "", code: "RFID_NO_CARD_DETECTED" } };
            }

            return { uid };
        } catch (err) {
            return { error: { message: "There was an error while reading the serial number", details: err.message, code: err.name } };
        }
    }

    async onStartup(): Promise<void> {
        // Read settings from settings.json and validate against settings.Schema.json
        const settingsSchemaFileContents = fs.readFileSync("settings.Schema.json", { encoding: "utf-8" });
        const settingsSchema = JSON.parse(settingsSchemaFileContents);
        const settingsFileContents = fs.readFileSync("settings.json", { encoding: "utf-8" });
        this.settings = JSON.parse(settingsFileContents);
        if (!validate(this.settings, settingsSchema).valid) {
            throw new Error("The settings file doesn't match the schema and is invalid");
        }

        // Create an instance of a ReaderImplementation depending on the deviceType
        const deviceTypeLower = this.settings.deviceType.toLowerCase();
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
            this.settings.logoutOnCardRemoved = false;
            this.changeMenuItemProperty("logoutOnCardRemoved", {
                enabled: false
            });
            break;
        default:
            throw new Error(`Reader type "${this.settings.deviceType}" is not supported`);
        }

        // Create RFIDLogic object. It handles polling of the Reader and errors.
        this.rfidLogic = new RFIDLogic(this.rfidCom);
        // Push an update handler to the RFIDLogic object. It is called when a card is removed
        // or a new card is detected.
        this.rfidLogic.addUpdateHandler(uid => {
            if (uid && this.settings.loginWhenCardDetected) {
                this.emit("login", {
                    uid,
                    domain: this.settings.loginDomain
                });
            } else if (!uid && this.settings.logoutOnCardRemoved) {
                this.emit("logout", null);
            }
        });

        // Add an error handler. This is called when a connection error occurs.
        this.rfidLogic.onDeviceError = (() => {
            this.deviceError.acknowledged = false;
            this.deviceError.active = true;
            if (this.deviceError.show) {
                this.emit("showDeviceError", { comPort: this.settings.comPort });
            }
        }).bind(this);

        // Start polling with the RFIDLogic instance
        this.rfidLogic.start(this.settings.comPort);

        // Get a list of available COM ports and display them in the application menu
        const comPorts = await this.rfidCom.listComPorts();
        if (comPorts) {
            const comPortMenuItems = Array.from(comPorts).map(value => {
                return {
                    label: `COM${value}`,
                    click: "changeComPort",
                    type: "radio",
                    checked: this.settings.comPort === value
                } as MenuItemConstructor;
            });
            this.changeMenuItemProperty("comPorts", {
                submenu: comPortMenuItems
            });
        }

        // Toggle the checkbox values according to the value in the settings.json
        this.changeMenuItemProperty("logoutOnCardRemoved", {
            checked: this.settings.logoutOnCardRemoved
        });

        this.changeMenuItemProperty("loginWhenCardDetected", {
            checked: this.settings.loginWhenCardDetected
        });
    }

    onMessage(command: string, args: any): any {
        switch (command) {

        // Application menu callbacks
        case "changeComPort":
            return this.changeComPort(args.label);
        case "changeLogoutOnCardRemoved":
            this.settings.logoutOnCardRemoved = args.checked;
            return;
        case "changeLoginWhenCardDetected":
            this.settings.loginWhenCardDetected = args.checked;
            return;
        case "gotoUserConfiguration":
            this.emit("gotoUserConfiguration", this.settings.loginDomain);
            return;

        // This message is sent by the config page when configuring new users
        case "getCurrentUid":
            return this.getCurrentUid();
        // This message is sent by the renderer process to display device errors
        case "getNonAcknowledgedDeviceError":
            if (this.deviceError.active && !this.deviceError.acknowledged && this.deviceError.show) {
                this.emit("showDeviceError", { comPort: this.settings.comPort });
            }
            return;
        // This message is sent by the renderer process when a device error is acknowledged by the user
        case "acknowledgeDeviceError":
            if (args?.doNotShowAgain) this.deviceError.show = false;
            this.deviceError.acknowledged = true;
            return;

        }
    }

    onShutdown(): void {
        fs.writeFileSync("settings.json", JSON.stringify(this.settings, null, 4));
    }
}

export = RFIDAuth;
