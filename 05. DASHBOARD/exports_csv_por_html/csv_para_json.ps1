# csv_para_json.ps1 — Converte 00_MESCLADO_DEDUP_v2.csv → importar_firestore.json
# Pronto para importar no import-firestore.html
# Uso: .\csv_para_json.ps1

$inFile  = Join-Path $PSScriptRoot '00_MESCLADO_DEDUP_v2.csv'
$outFile = Join-Path $PSScriptRoot 'importar_firestore.json'

# Ler bytes para preservar encoding
$bytes = [System.IO.File]::ReadAllBytes($inFile)
$txt   = [System.Text.Encoding]::UTF8.GetString($bytes)
$lines = ($txt -split "`r?`n") | Where-Object { $_.Trim() -ne '' }

# Header — remover BOM
$header = ($lines[0] -split ';')
$header[0] = $header[0].TrimStart([char]0xFEFF)

# Colunas a excluir do JSON (metadados do merge, não vão pro Firestore)
$excluir = @('origem_csv', 'n_fontes')

# Campos numéricos
$numCols = @('etapa')

# Parse e conversão
$records = @()
for ($i = 1; $i -lt $lines.Count; $i++) {
    $cols = $lines[$i] -split ';'
    
    # Montar objeto apenas com campos válidos
    $obj = [ordered]@{}
    for ($j = 0; $j -lt $header.Count; $j++) {
        $col = $header[$j]
        if ($col -in $excluir) { continue }
        
        $val = if ($j -lt $cols.Count) { $cols[$j].Trim() } else { '' }
        
        # Converter etapa para inteiro
        if ($col -in $numCols) {
            $n = 0
            if ([int]::TryParse($val, [ref]$n)) { $obj[$col] = $n }
            else { $obj[$col] = $null }
        }
        # docsPendentes: vira array vazio (campo de lista de docs pendentes)
        elseif ($col -eq 'docsPendentes') {
            $obj[$col] = @()
        }
        else {
            $obj[$col] = $val
        }
    }
    
    # Só adiciona se tiver uid
    if ($obj['uid'] -ne '') {
        $records += [PSCustomObject]$obj
    }
}

# Serializar JSON com System.Text.Json (disponível no .NET Core / PS 7)
# Fallback: ConvertTo-Json (PS 5)
$json = $records | ConvertTo-Json -Depth 5

# Gravar com UTF-8 BOM para compatibilidade
$enc      = New-Object System.Text.UTF8Encoding $true
$outBytes = $enc.GetBytes($json)
[System.IO.File]::WriteAllBytes($outFile, $outBytes)

Write-Host "Registros exportados: $($records.Count)"
Write-Host "Arquivo salvo: $outFile"
