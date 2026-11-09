$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class KubeWindowTest {
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr window, int index);
}
"@
$exe = Resolve-Path 'src-tauri/target/release/kube-desktop.exe'
# The runner needs to create a visible window to expose its Win32 style.
$app = [Diagnostics.Process]::Start($exe.Path)
try {
  $deadline = (Get-Date).AddSeconds(40)
  do {
    Start-Sleep -Milliseconds 300
    $app.Refresh()
    if ($app.HasExited) { throw 'Kube exited before creating its window' }
  } until ($app.MainWindowHandle -ne 0 -or (Get-Date) -gt $deadline)
  if ($app.MainWindowHandle -eq 0) { throw 'Kube did not create a main window' }
  $style = [KubeWindowTest]::GetWindowLong($app.MainWindowHandle, -16)
  if (($style -band 0x00C00000) -eq 0x00C00000) { throw 'Main window contains a native title bar' }
  if (($style -band 0x00040000) -eq 0) { throw 'Main window cannot be resized' }
  Write-Output 'Confirmed a resizable native window without a title bar.'
} finally {
  if (!$app.HasExited) { $app.Kill() }
}
