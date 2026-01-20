$env:Path += ";C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64"
signtool /?

$timestamp = "http://time.certum.pl"
Get-ChildItem "src-tauri\target\release\bundle" -Recurse -Include *.exe,*.msi |
   ForEach-Object {
     & signtool sign /fd sha256 /tr $timestamp /td sha256 /a $_.FullName
     if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}