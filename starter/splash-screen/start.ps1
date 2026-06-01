
param(
    [string]$AppDir = "",
    [string]$Personalnummer = ""
)

# Root-Verzeichnis dieses Scripts
$root = $PSScriptRoot

# Logging setup
$logDir = Join-Path $root "logs"
try { if (-not (Test-Path $logDir)) { New-Item -Path $logDir -ItemType Directory -Force | Out-Null } } catch { }
$logFile = Join-Path $logDir ("splash-start-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $line = "[$timestamp] [$Level] $Message"
    Write-Host $line
    try { Add-Content -Path $logFile -Value $line -Encoding UTF8 } catch { }
}

Write-Log "Script gestartet. Root: $root"

# DLL Pfade (relativ zum Script)
$dllDir = Join-Path $root "assemblies"
$mahAppsDll = Join-Path $dllDir "MahApps.Metro.dll"
$loadingDll = Join-Path $dllDir "LoadingIndicators.WPF.dll"
$interactivityDll = Join-Path $dllDir "System.Windows.Interactivity.dll"
$iconsXaml = Join-Path $root "resources/Icons.xaml"
$logoPath = Join-Path $root "media/RD-Plan Logo.gif"

# Hilfsfunktion: Datei-Check
function Test-File {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path $Path)) { Write-Log "$Label fehlt am Pfad: $Path" "ERROR"; return $false }
    return $true
}

# Check DLLs & Assets
$filesOk = (Test-File $mahAppsDll "MahApps DLL") -and 
           (Test-File $loadingDll "LoadingIndicators DLL") -and 
           (Test-File $interactivityDll "Interactivity DLL")

if (-not $filesOk) { 
    Write-Log "Abbruch: Assemblies fehlen im Verzeichnis des Scripts." "ERROR"
    exit 1 
}

# Assemblies laden
try {
    Add-Type -Path $mahAppsDll
    Add-Type -Path $loadingDll
    Add-Type -Path $interactivityDll
    Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
} catch {
    Write-Log "Laden der DLLs fehlgeschlagen: $($_.Exception.Message)" "ERROR"
    exit 1
}

# XAML Splashscreen
$xaml = @"
<Controls:MetroWindow 
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:Controls="clr-namespace:MahApps.Metro.Controls;assembly=MahApps.Metro"
    xmlns:loadin="clr-namespace:LoadingIndicators.WPF;assembly=LoadingIndicators.WPF"
    WindowStyle="None" WindowStartupLocation="CenterScreen" AllowsTransparency="True" ResizeMode="NoResize"
    Width="500" Height="600" Title="RD-Plan Splash" ShowTitleBar="False" BorderThickness="0" GlowBrush="{x:Null}">
    <Window.Resources>
        <ResourceDictionary>
            <ResourceDictionary.MergedDictionaries>
                <ResourceDictionary Source="pack://application:,,,/LoadingIndicators.WPF;component/Styles/LoadingArcs.xaml"/>
                <ResourceDictionary Source="pack://application:,,,/LoadingIndicators.WPF;component/Colors.xaml"/>
                <ResourceDictionary Source="pack://application:,,,/LoadingIndicators.WPF;component/Styles.xaml"/>
                <ResourceDictionary Source="$iconsXaml" />
                <ResourceDictionary Source="pack://application:,,,/MahApps.Metro;component/Styles/Controls.xaml" />
                <ResourceDictionary Source="pack://application:,,,/MahApps.Metro;component/Styles/Fonts.xaml" />
                <ResourceDictionary Source="pack://application:,,,/MahApps.Metro;component/Styles/Colors.xaml" />
                <ResourceDictionary Source="pack://application:,,,/MahApps.Metro;component/Styles/Accents/Cobalt.xaml" />
                <ResourceDictionary Source="pack://application:,,,/MahApps.Metro;component/Styles/Accents/BaseLight.xaml" />
            </ResourceDictionary.MergedDictionaries>
        </ResourceDictionary>
    </Window.Resources>
    <Window.Background>
        <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
            <GradientStop Color="#1e3a8a" Offset="0.0"/>
            <GradientStop Color="#3b82f6" Offset="1.0"/>
        </LinearGradientBrush>
    </Window.Background>
    <Grid>
        <StackPanel VerticalAlignment="Center" HorizontalAlignment="Center">
            <Border Background="White" CornerRadius="20" Padding="30" Margin="0,0,0,40">
                <Border.Effect><DropShadowEffect BlurRadius="60" ShadowDepth="20" Color="Black" Opacity="0.3"/></Border.Effect>
                <MediaElement Name="LoadingGif" Source="$logoPath" Width="200" Height="200" Stretch="Uniform" LoadedBehavior="Play" />
            </Border>
            <TextBlock Name="StatusText" Text="Initialisiere..." Foreground="White" FontSize="16" TextAlignment="Center" Margin="0,0,0,20"/>
             <loadin:LoadingIndicator Name="ArcsStyle" Style="{DynamicResource LoadingIndicatorArcsStyle}" SpeedRatio="2" Foreground="White" IsActive="True" Margin="0,5,0,0"/>
             <TextBlock Text="$env:USERNAME" Foreground="#FFFFFF" Opacity="0.7" FontSize="14" TextAlignment="Center" Margin="0,20,0,0"/>
             <TextBlock Name="VersionText" Text="v..." Foreground="White" Opacity="0.5" FontSize="12" TextAlignment="Center" Margin="0,10,0,0"/>
        </StackPanel>
    </Grid>
</Controls:MetroWindow>
"@

try {
    $reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($xaml))
    $window = [System.Windows.Markup.XamlReader]::Load($reader)
} catch {
    Write-Log "XAML Parse Fehler: $($_.Exception.Message)" "ERROR"
    exit 1
}

# Scope-Mapping f\u00fcr Tick-Handler
$script:appWindow = $window
$script:pNameDynamic = ""

$window.Add_Loaded({
    $statusText = $window.FindName("StatusText")
    $versionText = $window.FindName("VersionText")
    
    function Update-Status($msg) {
        if ($statusText) { $statusText.Text = $msg }
        Write-Log $msg
        [System.Windows.Threading.Dispatcher]::CurrentDispatcher.Invoke([Action]{}, [System.Windows.Threading.DispatcherPriority]::Render)
    }

    Update-Status "Lade Version..."
    $versionFile = Join-Path $root "version.json"
    $appVersion = "1.0.0" 
    if (Test-Path $versionFile) {
        try {
            $json = Get-Content $versionFile -Raw | ConvertFrom-Json
            if ($json.Version) { $appVersion = $json.Version }
        } catch { }
    }
    if ($versionText) { $versionText.Text = "v$appVersion" }

    # EXE finden
    $appExeName = "RD-Plan_$appVersion.exe"
    $appPath = ""
    if ($AppDir -and (Test-Path $AppDir)) { $appPath = Join-Path $AppDir $appExeName }
    if ((-not $appPath -or -not (Test-Path $appPath))) { $appPath = Join-Path $root $appExeName }

    if (Test-Path $appPath) {
        $script:pNameDynamic = [System.IO.Path]::GetFileNameWithoutExtension($appPath)
        Update-Status "Starte Anwendung..."
        $usernameRaw = $env:USERNAME
        $username = if ($usernameRaw -match '^[Hh]') { 'h' + $usernameRaw.Substring(1) } else { $usernameRaw }
        
        Start-Process -FilePath $appPath -ArgumentList "-h$username"
    } else {
        Update-Status "FEHLER: EXE nicht gefunden!"
    }

    # Prozess Überwachung
    Update-Status "Warte auf Prozess..."
    $timer = New-Object System.Windows.Threading.DispatcherTimer
    $timer.Interval = [TimeSpan]::FromMilliseconds(500)
    $timer.Add_Tick({
        param($sender, $e)
        
        # --- PROZESSERKENNUNG (wie im alten Script, aber ohne NULL-Fehler) ---
        $procRunning = $false
        
        # 1. Check Standard-Name
        if (Get-Process -Name "RD-Plan" -ErrorAction SilentlyContinue) { $procRunning = $true }
        
        # 2. Check Dynamischer Name (nur wenn nicht leer)
        if (-not $procRunning -and (-not [string]::IsNullOrWhiteSpace($script:pNameDynamic))) {
            if (Get-Process -Name $script:pNameDynamic -ErrorAction SilentlyContinue) { $procRunning = $true }
        }
        
        # 3. Check Electron (Dev)
        if (-not $procRunning -and (Get-Process -Name "electron" -ErrorAction SilentlyContinue)) { $procRunning = $true }

        if ($procRunning) {
            Write-Log "Prozess erkannt. Schlie\u00dfe Splash-Screen in 3 Sekunden..."
            if ($sender) { $sender.Stop() }

            $closeTimer = New-Object System.Windows.Threading.DispatcherTimer
            $closeTimer.Interval = [TimeSpan]::FromSeconds(3)
            $closeTimer.Add_Tick({
                param($s, $ev)
                $s.Stop()
                if ($script:appWindow) { $script:appWindow.Close() }
            })
            $closeTimer.Start()
        }
    })
    $timer.Start()
})

$window.ShowDialog() | Out-Null
