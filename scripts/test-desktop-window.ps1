$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class KubeWindowTest {
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr window, ref Point point);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);
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
  # Tauri can retain WS_CAPTION for native snap while extending the client area over it.
  $outer = [KubeWindowTest+Rect]::new()
  $origin = [KubeWindowTest+Point]::new()
  if (![KubeWindowTest]::GetWindowRect($app.MainWindowHandle, [ref]$outer) -or
      ![KubeWindowTest]::ClientToScreen($app.MainWindowHandle, [ref]$origin)) { throw 'Could not measure native window' }
  $inset = $origin.Y - $outer.Top
  $caption = [KubeWindowTest]::GetSystemMetrics(4)
  Write-Output "Client area begins $inset pixels below window top. System caption height is $caption pixels."
  if ($inset -ge $caption -or $caption -le 0) { throw 'Native caption occupies space above the client area' }
  if (($style -band 0x00040000) -eq 0) { throw 'Main window cannot be resized' }
  Write-Output 'Confirmed a resizable native window without a title bar.'
} finally {
  if (!$app.HasExited) { $app.Kill() }
}
