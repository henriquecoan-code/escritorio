# merge_dedup.ps1 — Mescla linhas com mesmo uid+data+cliente no CSV agrupado
# Uso: .\merge_dedup.ps1

$inFile  = Join-Path $PSScriptRoot '00_AGRUPADO_TODOS_CSVS.csv'
$outFile = Join-Path $PSScriptRoot '00_MESCLADO_DEDUP_v2.csv'

# Ler com bytes para preservar encoding
$bytes = [System.IO.File]::ReadAllBytes($inFile)
$txt   = [System.Text.Encoding]::UTF8.GetString($bytes)
$lines = ($txt -split "`r?`n") | Where-Object { $_.Trim() -ne '' }

# Header — remover BOM se presente
$header = ($lines[0] -split ';')
$header[0] = $header[0].TrimStart([char]0xFEFF)

# Parse de linhas em objetos
$rows = @()
for ($i = 1; $i -lt $lines.Count; $i++) {
    $cols = $lines[$i] -split ';'
    $obj  = [ordered]@{}
    for ($j = 0; $j -lt $header.Count; $j++) {
        $obj[$header[$j]] = if ($j -lt $cols.Count) { $cols[$j] } else { '' }
    }
    $rows += [PSCustomObject]$obj
}
Write-Host "Linhas carregadas: $($rows.Count)"

# Agrupar por uid + data + cliente
$grupos = $rows | Group-Object -Property uid, data, cliente

# Função de mesclagem de campo: pega valores não-vazios únicos; junta conflitos com " | "
function Merge-Field($group, [string]$field) {
    $vals = $group.Group | ForEach-Object { $_.$field.Trim() } |
            Where-Object { $_ -ne '' } | Select-Object -Unique
    return ($vals -join ' | ')
}

# Construir linhas mescladas
$merged = @()
foreach ($g in $grupos) {
    $row = [ordered]@{}
    foreach ($col in $header) {
        if ($col -eq 'origem_csv') {
            $row[$col] = (
                $g.Group | ForEach-Object { $_.origem_csv.Trim() } |
                Where-Object { $_ -ne '' } | Select-Object -Unique
            ) -join ' | '
        } else {
            $row[$col] = Merge-Field $g $col
        }
    }
    $row['n_fontes'] = $g.Count
    $merged += [PSCustomObject]$row
}

Write-Host "Registros únicos após merge: $($merged.Count)"
Write-Host "Com múltiplas fontes:        $(($merged | Where-Object { $_.n_fontes -gt 1 }).Count)"

# Serializar como CSV com ponto-e-vírgula
$allCols = $header + 'n_fontes'
$sb = New-Object System.Text.StringBuilder
$null = $sb.AppendLine(($allCols -join ';'))
foreach ($r in $merged) {
    $vals = $r.PSObject.Properties | ForEach-Object { $_.Value }
    $null = $sb.AppendLine(($vals -join ';'))
}
$outTxt = $sb.ToString()

# Gravar com UTF-8 BOM para Excel
$enc = New-Object System.Text.UTF8Encoding $true
$bom = $enc.GetPreamble()
$dataBytes = [System.Text.Encoding]::UTF8.GetBytes($outTxt)
$outBytes = $bom + $dataBytes
[System.IO.File]::WriteAllBytes($outFile, $outBytes)

Write-Host "Arquivo salvo: $outFile"
