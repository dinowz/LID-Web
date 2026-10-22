$file = 'd:\programming\LIND digitalization\frontend\src\pages\Service\Quotations\Detail.jsx'
$content = Get-Content $file -Raw

# Remove all isExternalTFS variable declarations and checks
# Replace isExternalTFS checks with false (remove TFS shortcut path)
$content = $content -replace "const isExternalTFS = quotation\.inquiry\?\.requestType === 'SERVICE_EXTERNAL_TFS';`r`n", ""
$content = $content -replace "const isExtTFS = quotation\.inquiry\?\.requestType === 'SERVICE_EXTERNAL_TFS';`r`n", ""
$content = $content -replace "const isDraftExtTFS = quotation\.inquiry\?\.requestType === 'SERVICE_EXTERNAL_TFS';`r`n", ""

# In the REALIZED auto-create service button check - replace isExternalTFS with false
$content = $content -replace "isExternalTFS", "false"
$content = $content -replace "isExtTFS", "false"
$content = $content -replace "isDraftExtTFS", "false"
$content = $content -replace "quotation\?\.inquiry\?\.requestType === 'SERVICE_EXTERNAL_TFS'", "false"
$content = $content -replace "quotation\.inquiry\?\.requestType === 'SERVICE_EXTERNAL_TFS'", "false"

Set-Content -Path $file -Value $content -NoNewline
Write-Host "Done patching Quotations/Detail.jsx"
