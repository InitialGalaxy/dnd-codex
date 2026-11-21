' DnD Codex launcher: starts the codex in the background (no black window) and opens it in its
' own window. Make a shortcut with "Make taskbar shortcut.bat", then pin that to your taskbar.
' The background part stops by itself a couple of minutes after every codex window is closed.
' Run it with the word home after it (DnD Codex.vbs home) for home Wi-Fi only (no internet door).
Option Explicit
Dim sh, fso, dir, env, port, url, i, exe, ok

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir

Function ReadPort()
  Dim f
  ReadPort = ""
  On Error Resume Next
  If fso.FileExists(dir & "\codex-port.txt") Then
    Set f = fso.OpenTextFile(dir & "\codex-port.txt", 1)
    ReadPort = Trim(f.ReadAll)
    f.Close
  End If
End Function

Function Alive(p)
  Dim x
  Alive = False
  If p = "" Then Exit Function
  On Error Resume Next
  Set x = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  x.setTimeouts 1500, 1500, 1500, 1500
  x.open "GET", "http://127.0.0.1:" & p & "/", False
  x.send
  If Err.Number = 0 Then
    If x.status > 0 Then Alive = True
  End If
End Function

Function FindBrowser()
  Dim c, paths
  FindBrowser = ""
  paths = Array("%ProgramFiles%\Google\Chrome\Application\chrome.exe", _
                "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe", _
                "%LocalAppData%\Google\Chrome\Application\chrome.exe", _
                "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe", _
                "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe")
  For Each c In paths
    c = sh.ExpandEnvironmentStrings(c)
    If fso.FileExists(c) Then
      FindBrowser = c
      Exit Function
    End If
  Next
End Function

' Is it already running? Then just open another window.
port = ReadPort()
If Not Alive(port) Then
  If sh.Run("cmd /c where node", 0, True) <> 0 Then
    MsgBox "DnD Codex needs Node.js, which isn't installed on this computer yet." & vbCrLf & vbCrLf & _
           "Install the LTS version from nodejs.org (opening now), then open DnD Codex again.", vbExclamation, "DnD Codex"
    sh.Run "https://nodejs.org/"
    WScript.Quit
  End If
  On Error Resume Next
  If fso.FileExists(dir & "\codex-port.txt") Then fso.DeleteFile dir & "\codex-port.txt"
  On Error GoTo 0
  Set env = sh.Environment("Process")
  env("NO_BROWSER") = "1"
  env("CODEX_AUTOSTOP") = "1"
  If WScript.Arguments.Count > 0 Then
    If LCase(WScript.Arguments(0)) = "home" Then env("FUNNEL") = "off"
  End If
  sh.Run "cmd /c node server.js > codex.log 2>&1", 0, False
  ok = False
  For i = 1 To 80
    WScript.Sleep 250
    port = ReadPort()
    If port <> "" Then
      If Alive(port) Then
        ok = True
        Exit For
      End If
    End If
  Next
  If Not ok Then
    MsgBox "DnD Codex didn't start. The file codex.log in the DnD Codex folder says why (opening it now).", vbExclamation, "DnD Codex"
    If fso.FileExists(dir & "\codex.log") Then sh.Run "notepad """ & dir & "\codex.log"""
    WScript.Quit
  End If
End If

url = "http://localhost:" & port & "/"
exe = FindBrowser()
If exe <> "" Then
  sh.Run """" & exe & """ --app=" & url, 1, False
Else
  sh.Run url, 1, False
End If
