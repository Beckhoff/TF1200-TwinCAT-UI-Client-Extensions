const { TcUiClientExt } = require("@beckhoff/tc-ui-client-ext");
const { Dpapi } = require("@primno/dpapi");
const fs = require("fs");

class AutoLogin extends TcUiClientExt {
    /**
     * Gets the plaintext password of the user
     * @param {string} username Name of the user
     * @returns {string} Plaintext password
     */
    #getPassword(username) {
        if (!username || !this.settings.users[username]) {
            return "";
        }

        // Create a buffer from plaintext password and unprotect it with the DPAPI
        const encryptedBuffer = Buffer.from(this.settings.users[username], "base64");
        const decryptedBuffer = Dpapi.unprotectData(encryptedBuffer, null, "LocalMachine");
        return Buffer.from(decryptedBuffer).toString("utf8");
    }

    /**
     * Add the user to the list of users. If the user already exists, the password is updated.
     * @param {string} username Name of the user
     * @param {string} password Plaintext password
     */
    #addUser(username, password) {
        // When adding a new user, it needs to be added to the menu
        const updateMenuAfterwards = !(username in this.settings.users);

        // Create a buffer from plaintext password and protect it with the DPAPI
        const decryptedBuffer = Buffer.from(password, "utf8");
        const encryptedBuffer = Dpapi.protectData(decryptedBuffer, null, "LocalMachine");
        this.settings.users[username] = Buffer.from(encryptedBuffer).toString("base64");

        if (updateMenuAfterwards) {
            // Add the new user to the submenus in the menu bar
            this.changeMenuItemProperty("loginAtStartupAs", {
                submenu: [
                    {
                        label: username,
                        click: "changeAutoLoginUser",
                        type: "radio",
                        checked: false
                    }
                ]
            });

            this.changeMenuItemProperty("loginAs", {
                submenu: [
                    {
                        label: username,
                        click: "loginAs"
                    }
                ]
            });
        }
    }

    /**
     * This method is called during the initialization of the extension.
     * It sets up the initial state of the extension and reads a settings file.
     * It also sets dynamic menu items.
     */
    onStartup() {
        // Read the settings file and save it as a class member
        this.settings = JSON.parse(fs.readFileSync("settings.json"));

        // This property tracks whether the auto-login has already been performed
        this.autoLoginPerformed = false;

        // Set the checkbox status for loginAtStartup
        this.changeMenuItemProperty("loginAtStartup", {
            checked: this.settings.autoLogin
        });

        // If there are user accounts stored in the settings.json file, add those to the menu
        if (this.settings.users) {
            // Set the user list for loginAtStartupAs
            let userList = Object.keys(this.settings.users).map(username => ({
                label: username,
                click: "changeAutoLoginUser",
                type: "radio",
                checked: username === this.settings.autoLoginUser
            }));

            this.changeMenuItemProperty("loginAtStartupAs", {
                submenu: userList
            });

            // Set the user list for loginAs
            userList = Object.keys(this.settings.users).map(username => ({
                label: username,
                click: "loginAs"
            }));

            this.changeMenuItemProperty("loginAs", {
                submenu: userList
            });
        } else {
            this.settings.users = {};
        }
    }

    /**
     * This method is called whenever the extension receives a message from
     * the renderer or when the user clicks a menu item.
     * @param {string} command
     * @param {any} args
     */
    onMessage(command, args) {
        switch (command) {
            // The renderer process sends this command after the page is loaded to check if it should perform an auto-login
            case "autoLoginNecessary":
                if (this.settings.autoLogin && !this.autoLoginPerformed && this.settings.autoLoginUser) {
                    this.autoLoginPerformed = true;
                    return {
                        autoLogin: true,
                        autoLoginUsername: this.settings.autoLoginUser,
                        autoLoginPassword: this.#getPassword(this.settings.autoLoginUser)
                    };
                }
                return { autoLogin: false };

            case "addUser":
                this.#addUser(args.username, args.password);
                break;

            // This command is sent when the user toggles the 'Login at startup' checkbox in the menu bar.
            // The state of the checkbox is saved in the settings.
            case "toggleLoginAtStartup":
                this.settings.autoLogin = args.checked;
                break;

            // This command is sent when the user selects an account from the 'Login at startup as' submenu in the
            // menu bar. The selected account is saved in the settings.
            case "changeAutoLoginUser":
                this.settings.autoLoginUser = args.label;
                break;

            // This command is sent when the user clicks 'Logout' in the menu bar.
            // The 'logout' event is emitted to the renderer process which handles the logout.
            case "logout":
                this.emit("logout");
                break;

            // This command is sent when the user selects an account from the 'Login as' submenu in the menu bar.
            // The 'login' event is emitted to the renderer with the username and password.
            case "loginAs":
                this.emit("login", {
                    username: args.label,
                    password: this.#getPassword(args.label)
                });
                break;

            // This command is sent from the renderer process when the page is loaded. It tells the extension whether
            // the user is logged in to the TwinCAT HMI Server. The 'loginAs' menu item is enabled when the user is not
            // logged in and disabled when the user is logged in.
            case "setLoginStatus":
                this.changeMenuItemProperty("loginAs", {
                    enabled: args
                });
                break;

            // If this extension receives an unknown command, it returns an error message
            default:
                return { error: `Command '${command}' is not supported` };
        }
    }

    /**
     * This method is called when the extension is shutting down. It writes the settings to a file.
     */
    onShutdown() {
        fs.writeFileSync("settings.json", JSON.stringify(this.settings, 0, 4));
    }
}

module.exports = AutoLogin;
