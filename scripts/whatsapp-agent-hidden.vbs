' Ejecuta el worker de WhatsApp sin mostrar una ventana de consola.
Option Explicit
Dim fso, sh, here, root, command
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
root = fso.GetParentFolderName(here)
command = "cmd.exe /c cd /d """ & root & """ && node scripts\whatsapp-agent.mjs >> scripts\whatsapp-agent.log 2>&1"
sh.Run command, 0, True

