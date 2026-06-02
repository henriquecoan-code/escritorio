param(
  [Parameter(Mandatory = $true)]
  [string]$EncryptedFile,

  [string]$OutputFile,

  [string]$Passphrase,

  [switch]$KeepTemporaryFiles
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Normalize-PathSafe {
  param([string]$PathValue)

  if (-not $PathValue) { return $PathValue }
  return [System.IO.Path]::GetFullPath($PathValue)
}

function Get-FileNameWithoutDoubleExtension {
  param([string]$Name)

  $result = $Name
  if ($result.EndsWith('.json.gz')) {
    $result = $result.Substring(0, $result.Length - 3)
  }
  return [System.IO.Path]::GetFileNameWithoutExtension($result)
}

function Get-PlainTextFromSecureString {
  param([Security.SecureString]$SecureString)

  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($SecureString)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringUni($ptr)
  } finally {
    if ($ptr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($ptr)
    }
  }
}

function Get-Pbkdf2Sha256Bytes {
  param(
    [byte[]]$PasswordBytes,
    [byte[]]$Salt,
    [int]$Iterations,
    [int]$Length
  )

  try {
    $derive = [System.Security.Cryptography.Rfc2898DeriveBytes]::new(
      $PasswordBytes,
      $Salt,
      $Iterations,
      [System.Security.Cryptography.HashAlgorithmName]::SHA256
    )
    return $derive.GetBytes($Length)
  } catch {
    $hmac = [System.Security.Cryptography.HMACSHA256]::new($PasswordBytes)
    try {
      $blockSize = $hmac.HashSize / 8
      $blockCount = [Math]::Ceiling($Length / $blockSize)
      $result = New-Object byte[] $Length
      $offset = 0

      for ($block = 1; $block -le $blockCount; $block++) {
        $indexBytes = [BitConverter]::GetBytes([uint32]$block)
        if ([BitConverter]::IsLittleEndian) {
          [Array]::Reverse($indexBytes)
        }

        $initial = New-Object byte[] ($Salt.Length + $indexBytes.Length)
        [Array]::Copy($Salt, 0, $initial, 0, $Salt.Length)
        [Array]::Copy($indexBytes, 0, $initial, $Salt.Length, $indexBytes.Length)

        $u = $hmac.ComputeHash($initial)
        $t = [byte[]]$u.Clone()

        for ($i = 2; $i -le $Iterations; $i++) {
          $u = $hmac.ComputeHash($u)
          for ($j = 0; $j -lt $t.Length; $j++) {
            $t[$j] = $t[$j] -bxor $u[$j]
          }
        }

        $bytesToCopy = [Math]::Min($t.Length, $Length - $offset)
        [Array]::Copy($t, 0, $result, $offset, $bytesToCopy)
        $offset += $bytesToCopy
      }

      return $result
    } finally {
      $hmac.Dispose()
    }
  }
}

function Decrypt-OpenSslEncFile {
  param(
    [string]$InputFile,
    [string]$OutputFile,
    [string]$Passphrase
  )

  $blob = [System.IO.File]::ReadAllBytes($InputFile)
  if ($blob.Length -lt 16) {
    throw 'Arquivo criptografado invalido ou incompleto.'
  }

  $header = [System.Text.Encoding]::ASCII.GetString($blob, 0, 8)
  if ($header -ne 'Salted__') {
    throw 'Formato invalido: o arquivo nao contem o cabecalho Salted__ do OpenSSL.'
  }

  $salt = New-Object byte[] 8
  [Array]::Copy($blob, 8, $salt, 0, 8)

  $cipherTextLength = $blob.Length - 16
  if ($cipherTextLength -le 0) {
    throw 'Arquivo criptografado invalido: sem dados apos o cabecalho.'
  }

  $cipherText = New-Object byte[] $cipherTextLength
  [Array]::Copy($blob, 16, $cipherText, 0, $cipherTextLength)

  $passBytes = [System.Text.Encoding]::UTF8.GetBytes($Passphrase)
  $keyIv = Get-Pbkdf2Sha256Bytes -PasswordBytes $passBytes -Salt $salt -Iterations 10000 -Length 48
  $key = New-Object byte[] 32
  $iv = New-Object byte[] 16
  [Array]::Copy($keyIv, 0, $key, 0, 32)
  [Array]::Copy($keyIv, 32, $iv, 0, 16)

  $aes = [System.Security.Cryptography.Aes]::Create()
  try {
    $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
    $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
    $aes.KeySize = 256
    $aes.BlockSize = 128
    $aes.Key = $key
    $aes.IV = $iv

    $decryptor = $aes.CreateDecryptor()
    try {
      $cipherStream = New-Object System.IO.MemoryStream(,$cipherText)
      try {
        $cryptoStream = New-Object System.Security.Cryptography.CryptoStream(
          $cipherStream,
          $decryptor,
          [System.Security.Cryptography.CryptoStreamMode]::Read
        )
        try {
          $plainStream = New-Object System.IO.MemoryStream
          try {
            $cryptoStream.CopyTo($plainStream)
            [System.IO.File]::WriteAllBytes($OutputFile, $plainStream.ToArray())
          } finally {
            $plainStream.Dispose()
          }
        } finally {
          $cryptoStream.Dispose()
        }
      } finally {
        $cipherStream.Dispose()
      }
    } finally {
      $decryptor.Dispose()
    }
  } finally {
    $aes.Dispose()
  }
}

function Get-DefaultOutputFile {
  param(
    [string]$OutputDirectory,
    [string]$SourceName
  )

  $name = Get-FileNameWithoutDoubleExtension -Name $SourceName
  return Join-Path $OutputDirectory $name
}

function Resolve-EncryptedInput {
  param([string]$InputFile)

  $fullPath = Normalize-PathSafe -PathValue $InputFile
  $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()

  if ($extension -eq '.enc') {
    return [pscustomobject]@{
      EncryptedFilePath = $fullPath
      OutputDirectory   = Split-Path -Parent $fullPath
      SourceName        = [System.IO.Path]::GetFileName($fullPath)
      CleanupPath       = $null
    }
  }

  if ($extension -eq '.zip') {
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ('ob-backup-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    Expand-Archive -LiteralPath $fullPath -DestinationPath $tempDir -Force

    $encFile = Get-ChildItem -LiteralPath $tempDir -Recurse -Filter '*.enc' | Select-Object -First 1
    if (-not $encFile) {
      throw "O ZIP nao contem nenhum arquivo .enc: $InputFile"
    }

    return [pscustomobject]@{
      EncryptedFilePath = $encFile.FullName
      OutputDirectory   = Split-Path -Parent $fullPath
      SourceName        = [System.IO.Path]::GetFileName($encFile.Name)
      CleanupPath       = $tempDir
    }
  }

  throw 'Formato nao suportado. Use um arquivo .enc ou o ZIP baixado do GitHub Actions.'
}

if (-not (Test-Path -LiteralPath $EncryptedFile)) {
  throw "Arquivo nao encontrado: $EncryptedFile"
}

$resolved = Resolve-EncryptedInput -InputFile $EncryptedFile
$EncryptedFile = $resolved.EncryptedFilePath

if (-not $OutputFile) {
  $OutputFile = Get-DefaultOutputFile -OutputDirectory $resolved.OutputDirectory -SourceName $resolved.SourceName
}

$OutputFile = Normalize-PathSafe -PathValue $OutputFile

if (-not $Passphrase) {
  $secure = Read-Host 'Digite a passphrase do backup' -AsSecureString
  $Passphrase = Get-PlainTextFromSecureString -SecureString $secure
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('ob-restore-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempRoot | Out-Null

$tempGz = Join-Path $tempRoot 'backup.json.gz'
$tempJson = Join-Path $tempRoot 'backup.json'
$parentDir = Split-Path -Parent $OutputFile
if ($parentDir -and -not (Test-Path -LiteralPath $parentDir)) {
  New-Item -ItemType Directory -Path $parentDir | Out-Null
}

$env:BACKUP_PASSPHRASE = $Passphrase

try {
  Write-Host "Descriptografando: $EncryptedFile"
  Write-Host "Saida temporaria gz: $tempGz"
  Write-Host "Saida final json: $OutputFile"

  Decrypt-OpenSslEncFile -InputFile $EncryptedFile -OutputFile $tempGz -Passphrase $Passphrase

  $sourceStream = [System.IO.File]::OpenRead($tempGz)
  try {
    $gzipStream = [System.IO.Compression.GzipStream]::new(
      $sourceStream,
      [System.IO.Compression.CompressionMode]::Decompress
    )
    try {
      $targetStream = [System.IO.File]::Create($tempJson)
      try {
        $gzipStream.CopyTo($targetStream)
      } finally {
        $targetStream.Dispose()
      }
    } finally {
      $gzipStream.Dispose()
    }
  } finally {
    $sourceStream.Dispose()
  }

  Get-Content -LiteralPath $tempJson -Raw | ConvertFrom-Json | Out-Null

  if (Test-Path -LiteralPath $OutputFile) {
    Remove-Item -LiteralPath $OutputFile -Force
  }
  Move-Item -LiteralPath $tempJson -Destination $OutputFile -Force

  Write-Host "Backup restaurado com sucesso: $OutputFile"
}
finally {
  Remove-Item Env:BACKUP_PASSPHRASE -ErrorAction SilentlyContinue
  if ($resolved -and $resolved.CleanupPath) {
    Remove-Item -LiteralPath $resolved.CleanupPath -Recurse -Force -ErrorAction SilentlyContinue
  }
  if (-not $KeepTemporaryFiles) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}

<#
USO RAPIDO:

.\scripts\restore-firestore-backup.ps1 -EncryptedFile "C:\Users\henri\Downloads\firestore-20260602-025318.json.gz.enc"

Se o arquivo estiver ao lado do .enc, o .json final sera gravado no mesmo lugar.
#>
