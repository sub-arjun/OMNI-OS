!macro customInstall
  DeleteRegKey HKCR "appomni"
  WriteRegStr HKCR "appomni" "" "URL:appomni"
  WriteRegStr HKCR "appomni" "URL Protocol" ""
  WriteRegStr HKCR "appomni\shell" "" ""
  WriteRegStr HKCR "appomni\shell\Open" "" ""
  WriteRegStr HKCR "appomni\shell\Open\command" "" "$INSTDIR\{APP_EXECUTABLE_FILENAME} %1"
!macroend

!macro customUnInstall
  DeleteRegKey HKCR "appomni"
!macroend

# Fix Can not find Squirrel error
# https://github.com/electron-userland/electron-builder/issues/837#issuecomment-355698368
!macro customInit
  nsExec::Exec '"$LOCALAPPDATA\OMNI\Update.exe" --uninstall -s'
!macroend
