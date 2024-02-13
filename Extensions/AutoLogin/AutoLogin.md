# AutoLogin

This extension enables automatic login to the TwinCAT HMI Server directly from
the TwinCAT UI Client. It utilizes a custom application menu for configuration.
The properties of the menu are edited dynamically at runtime. The login process
is handled by a script containing custom
[renderer code](../../README.md#renderer-code). The script sends a message to
the extension at startup to check if a login is required. If so, the extension
establishes a WebSocket connection to the TwinCAT HMI Server and sends the
login credentials. It then replaces the session cookie with the session ID
received from the TwinCAT HMI Server as a response.

The login credentials are stored in the [settings.json](settings.json) file.
For security reasons the passwords aren't stored in plaintext. Instead, the
Windows [Data Protection API](https://en.wikipedia.org/wiki/Data_Protection_API)
is used with the [`dpapi`](https://github.com/primno/dpapi) module to encrypt
and decrypt the plaintext passwords. You can send the `"addUser"` message to
add user accounts you want to use with the extension.

```js
tcuiclient.postMessage(
    "AutoLogin.addUser",
    {
        username: "Operator",
        password: "test"
    }
);
```

To ensure proper functionality of this sample extension, you must have a
running instance of the
[TwinCAT HMI Server](https://infosys.beckhoff.com/content/1031/tf2000_tc3_hmi_server/index.html).
Update the `startUrl` in the configuration file of the TwinCAT UI Client to
point to the TwinCAT HMI Server instance. Also, replace the login credentials
in the *settings.json* file in this directory with the credentials of your
TwinCAT HMI Server instance.
