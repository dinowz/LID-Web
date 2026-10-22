$file = 'd:\programming\LIND digitalization\frontend\src\pages\Service\Quotations\List.jsx'
$content = Get-Content $file -Raw

$content = $content -replace "'SERVICE_EXTERNAL_TFS': 'EXTERNAL_TFS',`r`n  'SERVICE_IC_TFS': 'IC_TFS',", "'SERVICE_EXTERNAL_TFS': 'EXTERNAL_TFS',`r`n  'SERVICE_EXTERNAL': 'EXTERNAL',`r`n  'SERVICE_IC_TFS': 'IC_TFS',"

$content = $content -replace "  EXTERNAL_TFS: \{ label: 'External TFS', color: 'gray' \},`r`n  IC_TFS: \{ label: 'IC", "  EXTERNAL_TFS: { label: 'External TFS', color: 'gray' },`r`n  EXTERNAL: { label: 'External Service', color: 'geekblue' },`r`n  IC_TFS: { label: 'IC"

Set-Content -Path $file -Value $content -NoNewline
Write-Host "Done updating Quotations/List.jsx"


$file2 = 'd:\programming\LIND digitalization\frontend\src\pages\Service\PO\List.jsx'
$content2 = Get-Content $file2 -Raw
$content2 = $content2 -replace "SERVICE_EXTERNAL_TFS: 'External TFS',", "SERVICE_EXTERNAL_TFS: 'External TFS',`r`n          SERVICE_EXTERNAL: 'External Service',"
Set-Content -Path $file2 -Value $content2 -NoNewline
Write-Host "Done updating PO/List.jsx"
