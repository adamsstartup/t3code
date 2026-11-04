# Dev servers

**Dev servers** shows what your threads left running across your connected environments, so you
can stop it without hunting for the thread or terminal that started it. On web and desktop, open
it from the sidebar, next to **Pull requests** and **Usage**, or choose **Open dev servers** in the
command palette. Press `Escape` to return to the previous page.

## What the page shows

**Servers** lists the local servers that a thread's terminals or its agent started, grouped by
that thread, with their ports. Not every listed port serves a web page.

Only servers that T3 Code started appear. A server you start in another app's terminal, or one
that was already running, is not listed, because T3 Code cannot tell which thread it belongs to.
See [Local servers](./remote-access.md#local-servers) for how T3 Code finds these ports and how to
turn port discovery off.

**Devices** lists the iOS Simulators and Android Emulators that are booted on the machine that
hosts the environment and on your [SSH device hosts](./devices.md#ssh-device-hosts). Physical
devices are not listed.

## Stop a server or shut down a device

**Stop** ends the server's job and keeps the thread, its terminal, and T3 Code running. Stop needs
terminal access to the environment and is not available on Windows. **Shut down** powers off the
simulator or emulator.

## Start a project script

**Start** lists each project's scripts. Add scripts to a project in **Settings → Projects**, which
**Edit scripts** opens. Choose the thread to run them in from the project's thread menu. It lists
the project's open threads, most recently active first, leaving out archived threads, subagents,
side chats, and threads a tag filter hides. It shows each worktree thread's path and remembers the
thread you last chose for each project.

Choose **Start** on a script to open that thread and run the script in its terminal drawer. The
script runs in that thread's checkout, so a worktree thread runs it in its worktree. When a
project has no threads yet, open a thread in it first. Starting scripts needs terminal access to
the environment.
