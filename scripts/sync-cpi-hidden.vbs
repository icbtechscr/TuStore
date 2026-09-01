' Lanza la sincronizacion CPI (ventas + cotizaciones) SIN ventana visible.
' Usado por el Programador de tareas para que no aparezca la ventana negra.
Option Explicit
Dim fso, sh, here, bat
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
bat = here & "\sync-cpi-all-auto.bat"
' 0 = ventana oculta ; True = esperar a que termine
sh.Run """" & bat & """", 0, True
