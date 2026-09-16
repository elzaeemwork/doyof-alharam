!macro customInit
  nsExec::Exec 'taskkill /F /T /IM "ضيوف الحرم.exe"'
  nsExec::Exec 'powershell -NoProfile -Command "Stop-Process -Name ''ضيوف الحرم'' -Force -ErrorAction SilentlyContinue"'
  Sleep 1200
  DeleteRegValue HKCU "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
  DeleteRegValue HKCU "${UNINSTALL_REGISTRY_KEY}" "QuietUninstallString"
  DeleteRegValue HKLM "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
  DeleteRegValue HKLM "${UNINSTALL_REGISTRY_KEY}" "QuietUninstallString"
!macroend

!macro customCheckAppRunning
  nsExec::Exec 'taskkill /F /T /IM "ضيوف الحرم.exe"'
  nsExec::Exec 'powershell -NoProfile -Command "Stop-Process -Name ''ضيوف الحرم'' -Force -ErrorAction SilentlyContinue"'
  Sleep 1500
!macroend

!macro customInstall
  nsExec::Exec 'taskkill /F /T /IM "ضيوف الحرم.exe"'
  nsExec::Exec 'powershell -NoProfile -Command "Stop-Process -Name ''ضيوف الحرم'' -Force -ErrorAction SilentlyContinue"'
  Sleep 1000
!macroend

!macro customUnInstallCheck
  StrCpy $R0 0
!macroend

!macro customUnInstallCheckCurrentUser
  StrCpy $R0 0
!macroend

!macro customUnInit
  nsExec::Exec 'taskkill /F /T /IM "ضيوف الحرم.exe"'
  nsExec::Exec 'powershell -NoProfile -Command "Stop-Process -Name ''ضيوف الحرم'' -Force -ErrorAction SilentlyContinue"'
  Sleep 1000
!macroend
