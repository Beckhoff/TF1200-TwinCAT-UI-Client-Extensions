//-----------------------------------------------------------------------
// <copyright file="RFIDAuth.cs" company="Beckhoff Automation GmbH & Co. KG">
//     Copyright (c) Beckhoff Automation GmbH & Co. KG. All Rights Reserved.
// </copyright>
//-----------------------------------------------------------------------

using TcHmiSrv.Core;
using TcHmiSrv.Core.General;
using TcHmiSrv.Core.Listeners;
using TcHmiSrv.Core.Listeners.AuthListenerEventArgs;
using TcHmiSrv.Core.Listeners.ConfigListenerEventArgs;
using TcHmiSrv.Core.Listeners.RequestListenerEventArgs;
using TcHmiSrv.Core.Tools.Management;
using ValueType = TcHmiSrv.Core.ValueType;

namespace RFIDAuth
{
    // Represents the default type of the TwinCAT HMI server extension.
    public class RFIDAuth : IServerExtension
    {
        private readonly RequestListener _requestListener = new RequestListener();
        private readonly AuthListener _authListener = new AuthListener();
        private readonly ConfigListener _configListener = new ConfigListener();

        // Called after the TwinCAT HMI server loaded the server extension.
        public ErrorValue Init()
        {
            _requestListener.OnRequest += OnRequest;
            _authListener.OnLogin += OnLogin;
            _configListener.OnChange += OnChange;
            _configListener.OnDelete += OnDelete;
            _configListener.OnRename += OnRename;

            var serverContext = TcHmiApplication.Context;
            serverContext.Domain = "TcHmiSrv";
            var authDomainPath = TcHmiApplication.JoinPath("USERGROUPUSERS", TcHmiApplication.Context.Domain);

            if (TcHmiApplication.AsyncHost.GetConfigValue(serverContext, authDomainPath).Type == ValueType.Null)
            {
                var map = new Value { Type = ValueType.Map };
                var ret = TcHmiApplication.AsyncHost.ReplaceConfigValue(serverContext,
                    TcHmiApplication.JoinPath("USERGROUPUSERS", TcHmiApplication.Context.Domain), map);

                if (ret != ErrorValue.HMI_SUCCESS)
                {
                    return ret;
                }
            }

            return ErrorValue.HMI_SUCCESS;
        }

        private void OnChange(object sender, OnChangeEventArgs e)
        {
            var parts = TcHmiApplication.SplitPath(e.Path, StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length == 2 && parts[0] == "users")
            {
                var username = parts[1];
                var serverContext = e.Context;
                serverContext.Domain = "TcHmiSrv";

                var userPath = TcHmiApplication.JoinPath("USERGROUPUSERS", TcHmiApplication.Context.Domain, username);
                var userValue = TcHmiApplication.AsyncHost.GetConfigValue(serverContext, userPath);

                if (!userValue.IsMapOrStruct)
                {
                    userValue.Type = ValueType.Map;
                    userValue.Add("USERGROUPUSERS_LOCALE", "project");
                    userValue.Add("USERGROUPUSERS_AUTO_LOGOFF", "PT0S");
                    var usergroupsValue = new Value { Type = ValueType.Vector };
                    usergroupsValue.Add("__SystemUsers");
                    userValue.Add("USERGROUPUSERS_GROUPS", usergroupsValue);

                    _ = TcHmiApplication.AsyncHost.ReplaceConfigValue(serverContext, userPath, userValue);
                }
            }
        }

        private void OnDelete(object sender, OnDeleteEventArgs e)
        {
            var parts = TcHmiApplication.SplitPath(e.Path, StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length == 2 && parts[0] == "users")
            {
                var username = parts[1];

                // remove user from user group configuration
                var serverContext = e.Context;
                serverContext.Domain = "TcHmiSrv";

                var result = TcHmiApplication.AsyncHost.DeleteConfigValue(serverContext,
                    TcHmiApplication.JoinPath("USERGROUPUSERS", TcHmiApplication.Context.Domain,
                        username));

                if (result != ErrorValue.HMI_SUCCESS)
                {
                    throw new TcHmiException(result);
                }
            }
        }

        private void OnRename(object sender, OnRenameEventArgs e)
        {
            var partsOldPath = TcHmiApplication.SplitPath(e.OldPath);
            var partsNewPath = TcHmiApplication.SplitPath(e.NewPath);

            if (partsOldPath.Length == 2 && partsOldPath[0] == "users")
            {
                var oldUserName = partsOldPath[1];
                var newUserName = partsNewPath[1];

                // remove old user from user group configuration
                var serverContext = e.Context;
                serverContext.Domain = "TcHmiSrv";

                var result = TcHmiApplication.AsyncHost.RenameConfigValue(serverContext,
                    TcHmiApplication.JoinPath("USERGROUPUSERS", TcHmiApplication.Context.Domain,
                        oldUserName), TcHmiApplication.JoinPath("USERGROUPUSERS", TcHmiApplication.Context.Domain,
                        newUserName));

                if (result != ErrorValue.HMI_SUCCESS)
                {
                    throw new TcHmiException(result);
                }
            }
        }

        // Called when a client requests a symbol from the domain of the TwinCAT HMI server extension.
        private void OnRequest(object sender, OnRequestEventArgs e)
        {
            try
            {
                e.Commands.Result = RFIDAuthErrorValue.RFIDAuthSuccess;

                foreach (var command in e.Commands)
                {
                    try
                    {
                        // Use the mapping to check which command is requested
                        switch (command.Mapping)
                        {
                            case "ListUsers":
                                ListUsers(command);
                                break;

                            case "RenameUser":
                                RenameUser(e.Context, command);
                                break;

                            case "RemoveUser":
                                RemoveUser(e.Context, command);
                                break;

                            case "AddUser":
                                AddUser(e.Context, command);
                                break;

                            default:
                                command.ExtensionResult = RFIDAuthErrorValue.RFIDAuthFail;
                                command.ResultString = $"Unknown command '{command.Mapping}' not handled.";
                                break;
                        }
                    }
                    catch (Exception ex)
                    {
                        command.ExtensionResult = RFIDAuthErrorValue.RFIDAuthFail;
                        command.ResultString =
                            $"Calling command '{command.Mapping}' failed! Additional information: {ex}";
                    }
                }
            }
            catch (Exception ex)
            {
                throw new TcHmiException(ex.ToString(), ErrorValue.HMI_E_EXTENSION);
            }
        }

        private void OnLogin(object sender, OnLoginEventArgs e)
        {
            if (e.Value.TryGetValue("password", out var uid) && !uid.IsEmpty)
            {
                var users = TcHmiApplication.AsyncHost.GetConfigValue(TcHmiApplication.Context, "users");

                foreach (KeyValuePair<string, Value> user in users)
                {
                    if (user.Value.TryGetValue("rfidCardUID", out var user_uid) && string.Equals(user_uid.ToString(),
                            uid.ToString(), StringComparison.OrdinalIgnoreCase))
                    {
                        if (user.Value.TryGetValue("enabled", out var user_enabled) &&
                            user_enabled.Type == ValueType.Bool && !user_enabled)
                        {
                            throw new TcHmiException("User is not enabled", ErrorValue.HMI_E_AUTH_DISABLED);
                        }

                        e.Value.AddOrUpdate("replaceUserName", user.Key);
                        return;
                    }
                }

                throw new TcHmiException("Card UID not recognized", ErrorValue.HMI_E_AUTH_USER_NOT_FOUND);
            }
        }

        private void ListUsers(Command cmd)
        {
            var users = TcHmiApplication.AsyncHost.GetConfigValue(TcHmiApplication.Context, "users").Keys;
            cmd.ReadValue = new Value(users.Select(el => new Value(el)));
        }

        private void RenameUser(Context ctx, Command cmd)
        {
            var currentConfigPath = TcHmiApplication.JoinPath("users", cmd.WriteValue["currentUsername"]);
            var newConfigPath = TcHmiApplication.JoinPath("users", cmd.WriteValue["newUserName"]);
            var ret = TcHmiApplication.AsyncHost.RenameConfigValue(ctx, currentConfigPath, newConfigPath);

            if (ret != ErrorValue.HMI_SUCCESS)
            {
                throw new TcHmiException(ret);
            }
        }

        private void RemoveUser(Context ctx, Command cmd)
        {
            var configPath = TcHmiApplication.JoinPath("users", cmd.WriteValue);
            var ret = TcHmiApplication.AsyncHost.DeleteConfigValue(ctx, configPath);

            if (ret != ErrorValue.HMI_SUCCESS)
            {
                throw new TcHmiException(ret);
            }
        }

        private void AddUser(Context ctx, Command cmd)
        {
            var configPath = TcHmiApplication.JoinPath("users", cmd.WriteValue["userName"]);
            var userValue = new Value { { "rfidCardUID", cmd.WriteValue["password"] } };

            if (cmd.WriteValue.TryGetValue("enabled", out var enabled))
            {
                userValue.Add("enabled", enabled);
            }

            var ret = TcHmiApplication.AsyncHost.ReplaceConfigValue(ctx, configPath, userValue);

            if (ret != ErrorValue.HMI_SUCCESS)
            {
                throw new TcHmiException(ret);
            }
        }
    }
}
