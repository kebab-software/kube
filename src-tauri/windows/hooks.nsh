!macro NSIS_HOOK_PREINSTALL
  ; Keep the legacy Electron installation separate when both products are present.
  IfFileExists "$INSTDIR\resources\app.asar" 0 +2
    StrCpy $INSTDIR "$LOCALAPPDATA\KubeApp"
!macroend
