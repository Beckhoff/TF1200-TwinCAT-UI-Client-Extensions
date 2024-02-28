# OnscreenKeyboard

This extension allows to open and close an on-screen keyboard from the renderer
process via the menu bar. For this purpose, the
[`child_process`](https://nodejs.org/api/child_process.html) API of *Node.JS*
is used to execute shell commands.

## Open the on-screen keyboard

To open an on-screen keyboard, an external command is executed.

### Open on Windows

To open the on-screen keyboard on Windows, the command *osk* is executed. As
Windows only allows one instance of the on-screen keyboard at the same time,
it's checked whether an instance is already running before a new one is opened.
It's also not permitted to execute the command *osk* directly from *Node.JS*.
Instead, the command *osk* is executed in a shell.

### Open on TC/BSD

To open the on-screen keyboard on TC/BSD, the command *wvkbd-mobintl* is
executed. This opens the
[On-screen keyboard for wlroots](https://github.com/jjsullivan5196/wvkbd),
which is available as a separate package
[wvkbd](https://www.freshports.org/x11/wvkbd) that must be installed
beforehand. Although it's not forbidden as on Windows, it also doesn't make
sense to open multiple on-screen keyboards on TC/BSD at the same time.
Therefore, it's also checked whether an *wvkbd-mobintl* process is already
running before a new one is opened.

## Close the on-screen keyboard

To close the on-screen keyboard, the corresponding process is terminated.

### Close on Windows

Closing the on-screen keyboard on Windows cannot be done with the command
`taskkill /IM osk.exe` because the *Node.JS* process lacks the required
permissions. Instead, the
[CimCmdlets](https://learn.microsoft.com/en-us/powershell/module/cimcmdlets)
of PowerShell are used to terminate the process *osk.exe*. The following
command searches the process list for a process named *osk.exe* and removes it
from the list which terminates the process:

```PowerShell
Get-CimInstance -Class Win32_Process -Filter "Name = 'osk.exe'" | Remove-CimInstance
```

### Close on TC/BSD

Closing the on-screen keyboard on TC/BSD is done using the command
[pkill](https://man.freebsd.org/cgi/man.cgi?query=pkill), which terminates
processes by name. The name of the process to terminate is *wvkbd-mobintl*.
